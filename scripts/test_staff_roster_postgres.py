#!/usr/bin/env python3
"""Exercise repository roster SQL only in a named, network-isolated disposable PG16 container.

Uses synthetic profile rows, never Auth accounts, external connections or app env files.
Run: python3 scripts/test_staff_roster_postgres.py --container luxeglow-roster-synthetic-7
"""
import argparse
from pathlib import Path
import re
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('--container', required=True)
args = parser.parse_args()
if not re.fullmatch(r'luxeglow-roster-synthetic-[a-zA-Z0-9-]+', args.container):
    parser.error('Dedicated luxeglow-roster-synthetic-<suffix> container required')
ROOT = Path(__file__).resolve().parents[1]
DB = 'staff_roster_synthetic'
ADMIN = '00000000-0000-4000-8000-000000000001'
HEAD = '00000000-0000-4000-8000-000000000002'
CUSTOMER = '00000000-0000-4000-8000-000000000003'
INACTIVE = '00000000-0000-4000-8000-000000000004'

def sql(query, database=DB, check=True):
    result = subprocess.run(['docker', 'exec', '-i', args.container, 'psql', '-X', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-Atq'], input=query, text=True, capture_output=True)
    if check and result.returncode:
        raise AssertionError(result.stderr)
    return result

def as_user(query, user=ADMIN, role='authenticated', check=True):
    return sql(f"begin; set local role {role}; set local test.user_id='{user}'; {query}; commit;", check=check)

def expect(query, expected):
    result = sql(query).stdout.strip()
    assert result == expected, (result, expected)

def denied(query, user=ADMIN, role='authenticated', message='permission denied'):
    result = as_user(query, user, role, check=False)
    assert result.returncode and message.lower() in result.stderr.lower(), result.stderr

sql(f'create database {DB};', database='postgres')
sql("""
create role anon nologin;
create role authenticated nologin;
create schema auth;
grant usage on schema auth,public to anon,authenticated;
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('test.user_id',true),'')::uuid;
$$;
create table public.profiles(id uuid primary key, role text, is_active boolean, first_name text, last_name text, position_title text, created_at timestamptz default now());
create table public.appointments(id uuid primary key default gen_random_uuid(),staff_id uuid references profiles(id));
create function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
""")
initial = (ROOT/'supabase/migrations/20260827000000_initial.sql').read_text()
for name in ['is_staff', 'is_admin']:
    match = re.search(rf'create or replace function public\.{name}\([\s\S]*?\n\$\$;', initial)
    assert match, name
    sql(match.group())
sql(f"insert into profiles(id,role,is_active,first_name,last_name) values ('{ADMIN}','admin',true,'Synthetic','Admin'),('{HEAD}','head',true,'Synthetic','Head'),('{CUSTOMER}','customer',true,'Synthetic','Customer'),('{INACTIVE}','admin',false,'Synthetic','Inactive');")
sql((ROOT/'supabase/migrations/20261014030000_independent_staff_roster.sql').read_text())
sql((ROOT/'supabase/migrations/20261026010000_booking_staff_management.sql').read_text())
sql("""
alter table appointments add column staff_member_id uuid references staff_members(id);
create table reviews(appointment_id uuid references appointments(id),staff_rating integer,is_published boolean);
create view published_staff_aggregates as select a.staff_member_id as staff_id, avg(r.staff_rating)::numeric as average_rating,count(r.staff_rating)::bigint as rating_count from appointments a join reviews r on r.appointment_id=a.id where r.is_published group by a.staff_member_id;
""")
cutover = (ROOT/'supabase/migrations/20261014030001_staff_roster_booking_cutover.sql').read_text()
bookable = re.search(r'create or replace function public\.get_bookable_staff\([\s\S]*?\n\$\$;', cutover)
assert bookable
sql(bookable.group())
sql('revoke all on function get_bookable_staff() from public; grant execute on function get_bookable_staff() to anon,authenticated;')

# SQL privileges and RPC checks: bypassing the frontend must not grant write access.
for user in [HEAD,CUSTOMER,INACTIVE,'']:
    denied("select create_booking_staff('Synthetic Forbidden',null)",user,message='Administrator access required')
denied("select create_booking_staff('Synthetic Anonymous',null)",role='anon')
denied("insert into staff_members(roster_key,record_kind,full_name) values('forged','staff','Synthetic Forged')")
denied('delete from staff_members')
for user in [HEAD,CUSTOMER,INACTIVE]:
    result=as_user("update staff_members set is_bookable=false returning id", user)
    assert not result.stdout.strip(), result.stdout
print('PASS anon/customer/Head/inactive-admin RPC denial; direct INSERT/DELETE denied; unauthorized UPDATE changes zero rows')

for expression in ["null", "'   '", "repeat('x',202)", "'Bad' || chr(1)"]:
    denied(f"select create_booking_staff({expression},null)",message='Full name must')
for expression in ["repeat('x',101)", "'Bad' || chr(1)"]:
    denied(f"select create_booking_staff('Synthetic Valid',{expression})",message='Position title must')
result=as_user("select create_booking_staff(E'  Synthetic\\n  Stylist  ',E'  Nail\\t Artist ')::text").stdout.strip()
import json
member=json.loads(result)
assert member['full_name']=='Synthetic Stylist' and member['position_title']=='Nail Artist'
assert member['record_kind']=='staff' and member['is_active'] and member['is_bookable']
assert member['roster_key']=='staff-'+member['id']
id=member['id']
second=json.loads(as_user("select create_booking_staff('Synthetic Stylist',' ')::text").stdout.strip())
assert second['id']!=id and second['position_title'] is None
assert not set(member).intersection({'role','email','password','user_id'})
print('PASS SQL normalization, required/name/title bounds, control rejection, JSON contract, optional title, same-name independent identities')

# Real existing public-booking function observes soft removal and restoration.
sql(f"insert into appointments(staff_id,staff_member_id) values('{HEAD}','{id}'); insert into reviews select id,5,true from appointments where staff_member_id='{id}';")
expect(f"select count(*) from get_bookable_staff() where id='{id}'",'1')
assert as_user(f"update staff_members set is_bookable=false where id='{id}' returning id").stdout.strip()==id
expect(f"select count(*) from get_bookable_staff() where id='{id}'",'0')
expect(f"select count(*) from staff_members where id='{id}'",'1')
expect(f"select count(*) from appointments a join reviews r on r.appointment_id=a.id where a.staff_member_id='{id}' and a.staff_id='{HEAD}' and r.staff_rating=5",'1')
as_user(f"update staff_members set is_bookable=true where id='{id}'")
expect(f"select count(*) from get_bookable_staff() where id='{id}'",'1')
as_user(f"update staff_members set is_active=false where id='{id}'")
expect(f"select count(*) from get_bookable_staff() where id='{id}'",'0')
expect('select count(*) from profiles','4')
print('PASS remove/restore/deactivate booking roster; appointment FK, legacy staff identity and published rating survive; profiles unchanged')
print('ALL DATABASE CHECKS PASSED')
