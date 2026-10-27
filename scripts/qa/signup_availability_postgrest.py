"""Synthetic-only PostgreSQL/PostgREST boundary and limiter regression.

Uses installed images, network=none, shared Unix socket, no host ports, no app
credentials/env files and no email/account services. Removes its own containers.
"""
from pathlib import Path
import base64, hashlib, hmac, json, subprocess, time
ROOT=Path(__file__).resolve().parents[2]
PG='luxe-email-availability-pg-local'
API='luxe-email-availability-postgrest-local'
JWT_SECRET='synthetic-local-availability-jwt-key-0123456789'
created=[]
VOLUME='luxe-email-availability-sockets-local'
volume_created=False
def run(*args, input=None, check=True):
 r=subprocess.run(args,input=input,text=True,capture_output=True,timeout=20)
 if check and r.returncode:raise RuntimeError(r.stderr[:2000])
 return r

def sql(text):return run('docker','exec','-i',PG,'psql','-h','/socket','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atq',input=text).stdout.strip()
def token(role):
 enc=lambda value:base64.urlsafe_b64encode(json.dumps(value,separators=(',',':')).encode()).decode().rstrip('=')
 value=enc({'alg':'HS256','typ':'JWT'})+'.'+enc({'role':role,'exp':int(time.time())+3600})
 return value+'.'+base64.urlsafe_b64encode(hmac.new(JWT_SECRET.encode(),value.encode(),hashlib.sha256).digest()).decode().rstrip('=')
def request(path, body=None, role=None, extra_headers=None):
 # The throwaway Deno process shares only the PostgREST loopback namespace.
 script='''const r = await fetch('http://127.0.0.1:3000'+Deno.args[0], {signal:AbortSignal.timeout(5000),method:Deno.args[1],headers:JSON.parse(Deno.args[2]),...(Deno.args[1]==='POST'?{body:Deno.args[3]}:{})}); console.log(JSON.stringify({status:r.status,body:await r.json()}));'''
 headers={'Content-Type':'application/json', **(extra_headers or {})}
 if role:headers['Authorization']='Bearer '+token(role)
 return json.loads(run('docker','run','--rm','--pull=never','--network','container:'+API,'denoland/deno:2.2.12','eval',script,path,'POST' if body is not None else 'GET',json.dumps(headers),json.dumps(body)).stdout)

try:
 if run('docker','volume','inspect',VOLUME,check=False).returncode==0:raise RuntimeError('Test volume already exists; refusing to reuse')
 run('docker','volume','create',VOLUME);volume_created=True
 run('docker','run','--rm','--pull=never','--network','none','--mount',f'type=volume,src={VOLUME},dst=/socket','--entrypoint','sh','postgres:16','-c','chmod 777 /socket')
 run('docker','run','-d','--pull=never','--name',PG,'--network','none','--mount',f'type=volume,src={VOLUME},dst=/socket','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:16','-c','unix_socket_directories=/var/run/postgresql,/socket','-c','listen_addresses=')
 created.append(PG)
 for _ in range(100):
  logs=run('docker','logs',PG,check=False)
  if 'init process complete' in logs.stdout+logs.stderr and run('docker','exec',PG,'pg_isready','-h','/socket','-U','postgres',check=False).returncode==0:break
  time.sleep(.1)
 else:raise RuntimeError('Synthetic PostgreSQL not ready: '+run('docker','logs',PG,check=False).stderr[-2000:])
 sql('''create role anon nologin; create role authenticated nologin; create role service_role nologin;
 create role availability_api login noinherit; grant anon,authenticated,service_role to availability_api;
 grant usage on schema public to anon,authenticated,service_role;
 create schema auth;
 create table auth.users(email text primary key, role text, confirmed boolean, active boolean);
 insert into auth.users values ('used@example.test','customer',true,true),('pending@example.test','customer',false,true),('staff@example.test','head',true,false);''')
 sql((ROOT/'supabase/migrations/20261027030000_signup_email_availability.sql').read_text())
 run('docker','run','-d','--pull=never','--name',API,'--network','none','--mount',f'type=volume,src={VOLUME},dst=/socket','-e','PGRST_DB_URI=postgresql://availability_api@localhost/postgres?host=/socket','-e','PGRST_DB_SCHEMAS=public','-e','PGRST_DB_ANON_ROLE=anon','-e','PGRST_JWT_SECRET='+JWT_SECRET,'public.ecr.aws/supabase/postgrest:v16.4')
 created.append(API)
 for _ in range(100):
  if 'API server listening' in run('docker','logs',API,check=False).stderr+run('docker','logs',API,check=False).stdout:break
  time.sleep(.1)
 else:
  logs=run('docker','logs',API,check=False)
  raise RuntimeError('Synthetic PostgREST not ready: '+(logs.stdout+logs.stderr)[-2400:])
 body={'p_email':'used@example.test','p_email_hash':'a'*64}
 for role in [None,'authenticated']:
  response=request('/rpc/check_signup_email_availability',body,role)
  assert response['status'] in (401,403,404),response
  response=request('/signup_email_check_limits',role=role)
  assert response['status'] in (401,403,404),response
  response=request('/users?select=email',role=role,extra_headers={'Accept-Profile':'auth'})
  assert response['status'] in (401,403,404,406),response
 print('PASS actual PostgREST anon/authenticated RPC, limiter-table and Auth email-inventory gates')
 for index,email in enumerate([' Used@EXAMPLE.test ','pending@example.test','staff@example.test','unused@example.test']):
  response=request('/rpc/check_signup_email_availability',{'p_email':email,'p_email_hash':str(index)*64},'service_role')
  assert response['status']==200,response
  assert response['body']=={'allowed':True,'available':index==3},response
 print('PASS service-only normalized minimal response with no account state/role distinction')
 for _ in range(3):
  response=request('/rpc/check_signup_email_availability',{'p_email':'budget@example.test','p_email_hash':'b'*64},'service_role')
  assert response['body']['allowed'] is True,response
 response=request('/rpc/check_signup_email_availability',{'p_email':'budget@example.test','p_email_hash':'b'*64},'service_role')
 assert response['body']['allowed'] is False and 'available' not in response['body'],response
 sql("update signup_email_check_limits set attempts=60 where scope='global'")
 response=request('/rpc/check_signup_email_availability',{'p_email':'rotated@example.test','p_email_hash':'c'*64},'service_role')
 assert response['body']['allowed'] is False and 'available' not in response['body'],response
 sql("update signup_email_check_limits set window_started_at=clock_timestamp()-interval '16 minutes' where scope='global'")
 response=request('/rpc/check_signup_email_availability',{'p_email':'rotated@example.test','p_email_hash':'c'*64},'service_role')
 assert response['body']=={'allowed':True,'available':True},response
 assert sql('select count(*) from auth.users')=='3', 'Lookup changed account inventory'
 print('PASS per-email/global exhaustion and window recovery; no account inventory mutation')
finally:
 for container in reversed(created):run('docker','rm','-f',container,check=False)
 if volume_created:run('docker','volume','rm',VOLUME,check=False)
