#!/usr/bin/env python3
"""Run unmodified repository RPCs in a disposable, network-isolated PG container.

Start: docker run -d --rm --network none --name luxeglow-availability-synthetic-8 \
  -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16
Run: python3 scripts/test_staff_availability.py --container luxeglow-availability-synthetic-8
Stop: docker stop luxeglow-availability-synthetic-8
No application env files or production connections are used.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import re
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('--container', required=True)
args = parser.parse_args()
if not re.fullmatch(r'luxeglow-availability-synthetic-[a-zA-Z0-9-]+', args.container):
    parser.error('Use a dedicated container named luxeglow-availability-synthetic-<suffix>')
ROOT = Path(__file__).resolve().parents[1]
DB = 'staff_availability_synthetic'
A = '00000000-0000-0000-0000-00000000000a'
B = '00000000-0000-0000-0000-00000000000b'
USER = '00000000-0000-0000-0000-000000000001'
DATE = "((now() at time zone 'Asia/Manila')::date + 2)"

def sql(query, database=DB, check=True):
    result = subprocess.run(['docker', 'exec', '-i', args.container, 'psql', '-X', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-At'], input=query, text=True, capture_output=True)
    if check and result.returncode:
        raise AssertionError(result.stderr)
    return result

def expect(query, expected):
    actual = sql(query).stdout.strip()
    assert actual == expected, (query, actual, expected)

def available(staff, when='11:00 AM', duration=30):
    staff_sql = f"'{staff}'" if staff else 'null'
    return f"select available from get_available_slots({staff_sql}, {DATE}, {duration}) where slot_time='{when}';"

def book(staff, when='11:00', service='short'):
    staff_sql = f"'{staff}'" if staff else 'null'
    return f"begin; set local test.customer_id='{USER}'; select assigned_staff_id from book_appointment(array['{service}'],{staff_sql},{DATE},'{when}'); commit;"

# The dedicated DB is recreated for repeatability, inside the named disposable container only.
sql(f'drop database if exists {DB}; create database {DB};', 'postgres')
sql((ROOT / 'frontend/test/fixtures/staffAvailability.sql').read_text())
migration = (ROOT / 'supabase/migrations/20261014030001_staff_roster_booking_cutover.sql').read_text()
for name in ['book_appointment', 'get_available_slots']:
    function = re.search(rf'create or replace function public\.{name}\([\s\S]*?\n\$\$;', migration)
    assert function, name
    sql(function.group())

expect(available(A), 't')
assert sql(book(A)).returncode == 0
for status in ['Pending', 'Confirmed']:
    sql(f"update appointments set status='{status}';")
    expect(available(A), 'f')
    expect(available(A, '10:30 AM', 60), 'f')  # duration extends into the reservation
    expect(available(A, '10:00 AM', 60), 't')  # end exactly at next start
    expect(available(A, '11:30 AM', 30), 't')  # start exactly at prior end
    expect(available(B), 't')
    expect(available(None), 't')
for status in ['Cancelled', 'Completed']:
    sql(f"update appointments set status='{status}';")
    expect(available(A), 't')
expect(available(A, '06:30 PM', 90), 't')  # end exactly at salon close
expect(available(A, '07:00 PM', 90), '')   # runs beyond close: absent slot
expect(f"set timezone='America/Los_Angeles'; {available(A)}", 'SET\nt')
expect(f"select start_at = ({DATE} + time '11:00') at time zone 'Asia/Manila' from appointments;", 't')
print('PASS overlap, full duration, half-open boundaries, closing boundary, statuses, Manila timezone, no preference')

sql('truncate appointment_services, appointments;')
expect(available(A), 't')  # stale browser snapshot
sql(book(A))
conflict = sql(book(A), check=False)
assert conflict.returncode and 'no longer available' in conflict.stderr, conflict.stderr
sql(f"update staff_members set is_active=false where id='{B}';")
assert 'available team member' in sql(book(B), check=False).stderr
sql(f"update staff_members set is_active=true,is_bookable=false where id='{B}';")
assert 'available team member' in sql(book(B), check=False).stderr
sql(f"update staff_members set is_bookable=true where id='{B}'; update profiles set is_active=false;")
assert 'active customer' in sql(book(B), check=False).stderr
sql('update profiles set is_active=true;')
print('PASS stale submission, inactive/unbookable staff, inactive customer')

# Independent connections race for the same staff/slot after observing availability.
sql('truncate appointment_services, appointments;')
expect(available(A), 't')
with ThreadPoolExecutor(max_workers=2) as pool:
    results = list(pool.map(lambda _: sql(book(A), check=False), range(2)))
assert sum(r.returncode == 0 for r in results) == 1, results
assert any('no longer available' in r.stderr for r in results)
expect('select count(*) from appointments;', '1')
# No preference allocates the two available members, then rejects excess capacity.
sql('truncate appointment_services, appointments;')
with ThreadPoolExecutor(max_workers=3) as pool:
    results = list(pool.map(lambda _: sql(book(None), check=False), range(3)))
assert sum(r.returncode == 0 for r in results) == 2, results
expect('select count(distinct staff_member_id) from appointments;', '2')
print('PASS real PostgreSQL concurrent selected-staff and no-preference submissions')
