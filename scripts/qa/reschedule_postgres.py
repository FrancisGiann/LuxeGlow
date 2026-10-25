"""Synthetic-only migration/state/race QA. Requires the explicitly approved container.
Never starts a container, never connects through a network or to a hosted database.
"""
from pathlib import Path
import subprocess, concurrent.futures, time
ROOT=Path(__file__).resolve().parents[2]
CONTAINER='luxe-reschedule-qa-20261025'
CMD=['docker','exec','-i',CONTAINER,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-qAt']
def sql(source,expect_error=False):
    p=subprocess.run(CMD,input=source,text=True,capture_output=True)
    if expect_error:
        assert p.returncode, 'Expected SQL denial, but operation succeeded'
        return p.stderr.strip()
    if p.returncode: raise RuntimeError(p.stderr+'\nSQL: '+source[:600])
    return p.stdout.strip()
def check(ok,label):
    assert ok,label
    print('PASS '+label,flush=True)
BOOTSTRAP='''
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
do $$ begin create role qa_browser login; exception when duplicate_object then null; end $$;
grant authenticated to qa_browser;
create schema auth;
create schema storage;
create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}'::jsonb,created_at timestamptz default now(),email_confirmed_at timestamptz,encrypted_password text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role',true),'') $$;
grant usage on schema auth,public to anon,authenticated,service_role;
grant execute on all functions in schema auth to anon,authenticated,service_role;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid);
create publication supabase_realtime;
'''
def session(uid,statement):
    return f"set session authorization qa_browser;set role authenticated;select set_config('request.jwt.claim.sub','{uid}',false);select set_config('request.jwt.claim.role','authenticated',false);"+statement
U1='10000000-0000-4000-8000-000000000001'; U2='10000000-0000-4000-8000-000000000002'; ADMIN='10000000-0000-4000-8000-000000000003'; HEAD='10000000-0000-4000-8000-000000000004';INACTIVE='10000000-0000-4000-8000-000000000005'
def value(uid,statement):
    return sql(session(uid,statement)).splitlines()[-1]
def request(uid,app,date,time):
    return value(uid,f"select (public.request_appointment_reschedule('{app}','{date}','{time}','Synthetic schedule conflict')).id;")
def review(uid,req,approve=True,reason='Choose another day'):
    return value(uid,f"select (public.review_appointment_reschedule('{req}',{str(approve).lower()},'{reason}')).status;")
def app(day,time='10:00',status='Confirmed',customer=U1,staff=None):
    suffix=staff or STAFF
    return sql(f"insert into public.appointments(reference_no,customer_id,staff_member_id,local_date,local_time,start_at,total_duration_minutes,total_price,status) values('QA-'||gen_random_uuid(),'{customer}','{suffix}','{day}','{time}',('{day}'::date+'{time}'::time) at time zone 'Asia/Manila',60,100,'{status}') returning id;")
def stamp(appid):
    return sql(f"select row_to_json(a) from (select start_at,status,staff_member_id,total_duration_minutes,total_price,arrived_at from public.appointments where id='{appid}') a;")
def book(uid,date,time,staff=None):
    return value(uid,f"select appointment_id from public.book_appointment(array['qa-service'],'{staff or STAFF}','{date}','{time}');")
if __name__=='__main__':
    database='luxe_reschedule_qa_'+str(time.time_ns())
    sql('create database '+database+';')
    CMD[CMD.index('-d')+1]=database
    sql(BOOTSTRAP)
    for migration in sorted((ROOT/'supabase/migrations').glob('*.sql')):
        sql(migration.read_text());print('MIGRATION '+migration.name,flush=True)
    users=[(U1,'customer'),(U2,'customer'),(ADMIN,'admin'),(HEAD,'head'),(INACTIVE,'admin')]
    for uid,role in users:
        sql(f"insert into auth.users(id,email)values('{uid}','{uid}@synthetic.invalid');update public.profiles set role='{role}',is_active={'false' if uid==INACTIVE else 'true'} where id='{uid}';")
    STAFF=sql("select id from public.staff_members where record_kind='staff' and is_active and is_bookable order by id limit 1;")
    STAFF2=sql(f"select id from public.staff_members where record_kind='staff' and is_active and is_bookable and id<>'{STAFF}' order by id limit 1;")
    assert STAFF and STAFF2
    # Fixed synthetic hours, dates relative to the test database's own clock.
    sql("update public.salon_weekly_hours set open_time='08:00',close_time='20:00',is_closed=false;insert into public.services(id,name,category,price,duration_minutes,is_active,item_type)values('qa-service','Synthetic service','Nails',100,60,true,'service');")
    days=[sql(f"select ((now() at time zone 'Asia/Manila')::date+{n})::text;") for n in range(2,50)]
    a=app(days[0]);before=stamp(a);r=request(U1,a,days[1],'11:00')
    check(stamp(a)==before,'submission preserves full original allocation and Confirmed status')
    check(value(U1,f"select count(*) from public.appointment_reschedule_requests where id='{r}';")=='1','owner reads request through RLS')
    check(value(U2,f"select count(*) from public.appointment_reschedule_requests where id='{r}';")=='0','other customer cannot read request')
    check('Appointment not found' in sql(session(U2,f"select public.request_appointment_reschedule('{a}','{days[1]}','12:00','reason');"),True),'nonowner cannot submit request')
    for actor in [ADMIN,HEAD]:
        check('Active customer access required' in sql(session(actor,f"select public.request_appointment_reschedule('{a}','{days[1]}','12:00','reason');"),True),'staff cannot initiate customer request: '+actor[-1])
    check('no longer available' in sql(session(U2,f"select public.book_appointment(array['qa-service'],'{STAFF}','{days[0]}','10:00');"),True),'pending request retains original slot against competing booking')
    sql(f"insert into public.notification_outbox(appointment_id,recipient_id,kind,payload) values('{a}','{U1}','reminder','{{}}');insert into public.user_notifications(customer_id,appointment_id,type,title,message) values('{U1}','{a}','reminder','Synthetic reminder','Synthetic reminder');")
    check(review(HEAD,r)=='approved','Head approves a customer request')
    check(sql(f"select status from public.appointments where id='{a}';")=='Confirmed','approval retains Confirmed status')
    check(sql(f"select count(*) from public.notification_outbox where appointment_id='{a}' and kind='reminder' and sent_at is null;")=='0','approval removes stale unsent reminders')
    check(sql(f"select is_read from public.user_notifications where appointment_id='{a}' and type='reminder';")=='t','approval marks old in-app reminder read')
    check(review(ADMIN,r)=='approved','repeated approval returns prior outcome')
    check(sql(f"select count(*) from public.notification_outbox where appointment_id='{a}' and kind='rescheduled';")=='1','approved move queues exactly one reschedule email')
    for actor in [ADMIN,HEAD,U1,INACTIVE]:
        check('permission denied' in sql(session(actor,f"select public.reschedule_appointment('{a}','{days[3]}','13:00');"),True),'direct staff reschedule RPC denied: '+actor[-1])
    for actor in [ADMIN,HEAD]:
        check(any(term in sql(session(actor,f"update public.appointments set status='Cancelled',cancellation_reason='Synthetic staff cancellation' where id='{a}';"),True).lower() for term in ['cancel','permission denied']),'direct staff cancellation denied: '+actor[-1])
    check('permission denied' in sql(session(U1,f"insert into public.appointment_reschedule_requests(appointment_id)values('{a}');"),True),'direct request-table writes denied')
    b=app(days[2]);rb=request(U1,b,days[3],'12:00');baseline=stamp(b);book(U2,days[3],'12:00')
    check(review(ADMIN,rb)=='conflicted','approval detects a booking that took the unreserved target')
    check(stamp(b)==baseline,'conflict retains original allocation')
    c=app(days[4]);rc=request(U1,c,days[5],'13:00');baseline=stamp(c)
    check(review(ADMIN,rc,False)=='rejected' and stamp(c)==baseline,'decline rejects request without cancelling original')
    d=app(days[6]);old=request(U1,d,days[7],'14:00');new=request(U1,d,days[8],'14:00')
    check(review(ADMIN,old)=='superseded','stale approval ID cannot approve a replacement request')
    check(review(HEAD,new)=='approved','replacement request can be approved')
    e=app(days[9]);re=request(U1,e,days[10],'14:00')
    sql(session(U1,f"select public.customer_cancel_appointment('{e}','Synthetic customer cancellation');"))
    check(review(ADMIN,re)=='stale','customer cancellation invalidates outstanding request')
    today=sql("select (now() at time zone 'Asia/Manila')::date::text;")
    f=app(today,'23:59');rf=request(U1,f,days[12],'14:00');value(HEAD,f"select public.mark_appointment_arrived('{f}');")
    check(review(HEAD,rf)=='stale','recorded arrival invalidates request')
    g=app(days[13]);rg=request(U1,g,days[14],'14:00');sql(f"insert into public.salon_closures(closure_date,reason) values('{days[14]}','Synthetic closure');")
    check(review(ADMIN,rg)=='stale','new closure invalidates proposed slot at approval')
    h=app(days[15]);rh=request(U1,h,days[16],'14:00');sql(f"update public.staff_members set is_bookable=false where id='{STAFF}';")
    check(review(ADMIN,rh)=='stale','staff deactivation invalidates proposed slot at approval');sql(f"update public.staff_members set is_bookable=true where id='{STAFF}';")
    i=app(days[17]);ri=request(U1,i,days[18],'14:00')
    for actor in [U1,U2,INACTIVE]:check('approval access required' in sql(session(actor,f"select public.review_appointment_reschedule('{ri}',true,null);"),True),'customer/inactive approver denied: '+actor[-1])
    # Real competing transactions; both requests initially target a free slot.
    j=app(days[19]);k=app(days[19],'12:00',customer=U2);rj=request(U1,j,days[20],'15:00');rk=request(U2,k,days[20],'15:00')
    def held_review():
        return value(ADMIN,f"begin;set application_name='luxe-race-first';select (public.review_appointment_reschedule('{rj}',true,null)).status;select pg_sleep(1);commit;")
    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        first=pool.submit(held_review)
        for _ in range(100):
            if sql("select count(*) from pg_stat_activity where application_name='luxe-race-first' and wait_event='PgSleep';")=='1':break
            time.sleep(0.02)
        else:raise AssertionError('First approval did not hold a transaction for the race')
        second=pool.submit(review,HEAD,rk)
        outcomes=[first.result(),second.result()]
    check(sorted(outcomes)==['approved','conflicted'],'two simultaneous approvals for one staff/slot yield exactly one move')
    check(sql(f"select count(*) from public.appointments where staff_member_id='{STAFF}' and local_date='{days[20]}' and local_time='15:00';")=='1','database has one winner after concurrent approvals')
    # Different staff may occupy the same time.
    book(U2,days[20],'15:00',STAFF2);check(True,'same time is bookable for a different staff member')
    # A concurrently committed ordinary booking must defeat a request approval.
    race_app=app(days[26]);race_request=request(U1,race_app,days[27],'12:00');race_baseline=stamp(race_app)
    def held_booking():
        return value(U2,f"begin;set application_name='luxe-booking-first';select appointment_id from public.book_appointment(array['qa-service'],'{STAFF}','{days[27]}','12:00');select pg_sleep(1);commit;")
    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        booking=pool.submit(held_booking)
        for _ in range(100):
            if sql("select count(*) from pg_stat_activity where application_name='luxe-booking-first' and wait_event='PgSleep';")=='1':break
            time.sleep(0.02)
        else:raise AssertionError('Competing booking did not hold its transaction')
        approval=pool.submit(review,ADMIN,race_request)
        booking.result();check(approval.result()=='conflicted','approval rechecks after concurrent booking commits')
    check(stamp(race_app)==race_baseline,'approval-versus-booking race retains original allocation')
    cancel_app=app(days[28]);cancel_request=request(U1,cancel_app,days[29],'12:00')
    def held_cancellation():
        return value(U1,f"begin;set application_name='luxe-cancel-first';select (public.customer_cancel_appointment('{cancel_app}','Synthetic cancellation')).status;select pg_sleep(1);commit;")
    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        cancellation=pool.submit(held_cancellation)
        for _ in range(100):
            if sql("select count(*) from pg_stat_activity where application_name='luxe-cancel-first' and wait_event='PgSleep';")=='1':break
            time.sleep(0.02)
        else:raise AssertionError('Cancellation did not hold its transaction')
        approval=pool.submit(review,HEAD,cancel_request)
        check(cancellation.result()=='Cancelled' and approval.result()=='stale','customer cancellation versus approval serializes without reopening or moving')
    # Profile-backed legacy assignments remain conservative salon-wide blockers.
    legacy=sql(f"insert into public.appointments(reference_no,customer_id,staff_id,local_date,local_time,start_at,total_duration_minutes,total_price,status) values('QA-LEGACY','{U1}','{ADMIN}','{days[30]}','10:00',('{days[30]}'::date+'10:00'::time) at time zone 'Asia/Manila',60,100,'Confirmed') returning id;")
    legacy_request=request(U1,legacy,days[31],'12:00')
    check(review(ADMIN,legacy_request)=='approved','legacy profile-backed assignment can be approved without rewriting staff identity')
    check(sql(f"select staff_id='{ADMIN}'::uuid and staff_member_id is null from public.appointments where id='{legacy}';")=='t','legacy assignment identity is retained')
    check('permission denied' in sql(session(HEAD,f"update public.appointments set local_time='15:00' where id='{legacy}';"),True),'raw appointment time updates are denied to Head')
    check('permission denied' in sql(session(ADMIN,f"update public.appointments set local_time='15:00' where id='{legacy}';"),True),'raw appointment time updates are denied to Admin')
    overlap_app=app(days[32]);overlap_request=request(U1,overlap_app,days[32],'10:30')
    check(value(U1,f"select count(*) from public.get_reschedule_slots('{overlap_app}','{days[32]}') where slot_time='10:30 AM';")=='1','availability excludes only the current allocation for a partially overlapping replacement')
    check(review(HEAD,overlap_request)=='approved','partially overlapping replacement moves atomically without releasing the original early')
    pending_app=app(days[33],status='Pending');pending_request=request(U1,pending_app,days[34],'12:00')
    check(review(ADMIN,pending_request)=='approved' and sql(f"select status from public.appointments where id='{pending_app}';")=='Pending','approval preserves Pending booking status and normal confirmation workflow')
    changed_app=app(days[35],status='Pending');changed_request=request(U1,changed_app,days[36],'12:00')
    sql(session(HEAD,f"update public.appointments set status='Confirmed' where id='{changed_app}';"))
    check(review(ADMIN,changed_request)=='stale','status changes invalidate requests based on the old appointment snapshot')
    for bad_time in ['10:00','10:15']:
        check('ERROR' in sql(session(U1,f"select public.request_appointment_reschedule('{changed_app}','{days[35]}','{bad_time}','reason');"),True),'same-time or off-grid request rejected: '+bad_time)
    check('ERROR' in sql(session(U1,f"select public.request_appointment_reschedule('{changed_app}',current_date+90,'12:00','reason');"),True),'request outside 60-day horizon rejected')
    check('permission denied' in sql(session(U1,f"select public.customer_reschedule_appointment('{changed_app}','{days[36]}','12:00','reason');"),True),'obsolete customer immediate-move RPC is denied')
    # Explicit maintenance clock tests preserve scheduled expiry, without waiting.
    late=app(days[21],status='Pending');r_late=request(U1,late,days[22],'14:00')
    sql(f"select public.run_appointment_maintenance(('{days[21]}'::date+'10:16'::time) at time zone 'Asia/Manila');")
    check(sql(f"select status from public.appointments where id='{late}';")=='Cancelled' and review(ADMIN,r_late)=='stale','scheduled Pending expiry still cancels and invalidates request')
    no_show=app(days[23]);r_ns=request(U1,no_show,days[25],'14:00')
    sql(f"select public.run_appointment_maintenance(('{days[24]}'::date+'10:01'::time) at time zone 'Asia/Manila');")
    check(sql(f"select status from public.appointments where id='{no_show}';")=='Cancelled' and review(HEAD,r_ns)=='stale','scheduled 24-hour no-show expiry still cancels and invalidates request')
    print('ALL SYNTHETIC POSTGRES CHECKS PASSED',flush=True)
