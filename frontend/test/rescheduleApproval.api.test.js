import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { pendingReschedule, latestReschedule, rescheduleOutcome, requestedTimeLabel } from '../src/utils/rescheduleRequests.js';

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const env = Object.fromEntries(['VITE_SUPABASE_URL','VITE_SUPABASE_ANON_KEY'].map((key) => [key,process.env[key]]));
const userId = '123e4567-e89b-42d3-a456-426614174000';
const appointmentId = '223e4567-e89b-42d3-a456-426614174000';
const requestId = '323e4567-e89b-42d3-a456-426614174000';
let server, customerApi, staffApi, supabase;
let role, active, result, responseStatus;
const calls = [];
globalThis.window = { location: { origin: 'https://fixture.invalid' } };
process.env.VITE_SUPABASE_URL = 'https://reschedule.fixture.invalid';
process.env.VITE_SUPABASE_ANON_KEY = 'synthetic-anon-key';
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  assert.equal(url.hostname,'reschedule.fixture.invalid','Every HTTP operation must remain mocked');
  const body = init.body ? JSON.parse(init.body) : null;
  calls.push({ path: url.pathname, method: init.method || 'GET', body });
  if (url.pathname.endsWith('/auth/v1/user')) return Response.json({ id: userId, email: 'synthetic@example.test', user_metadata: {} });
  if (url.pathname.endsWith('/rest/v1/profiles')) return Response.json({ role, is_active: active });
  if (url.pathname.includes('/rest/v1/rpc/')) return Response.json(result,{status:responseStatus});
  throw new Error(`Unexpected request: ${url.pathname}`);
};
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('..',import.meta.url)), configFile: false, server: { middlewareMode:true, hmr:false, ws:false, watch:null }, appType:'custom' });
  customerApi = await server.ssrLoadModule('/src/api/endpoints.js');
  staffApi = await server.ssrLoadModule('/src/api/admin.js');
  ({supabase} = await server.ssrLoadModule('/src/lib/supabase.js'));
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:userId,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})}.abcdefgh`;
  assert.equal((await supabase.auth.setSession({access_token:token,refresh_token:'synthetic-refresh'})).error,null);
});
beforeEach(() => { calls.length=0;role='admin';active=true;result={id:requestId,status:'pending'};responseStatus=200; });
after(async () => {
  await server?.close();globalThis.fetch=originalFetch;
  if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;
  for(const [key,value] of Object.entries(env)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
});

test('request sends normalized requested time and reason through the new RPC without patching the appointment',async()=>{
  const response=await customerApi.rescheduleMyAppointment(appointmentId,'2026-11-02','01:30 PM',' Change of plans ');
  assert.equal(response.request.id,requestId);
  assert.deepEqual(calls,[{path:'/rest/v1/rpc/request_appointment_reschedule',method:'POST',body:{p_appointment_id:appointmentId,p_date:'2026-11-02',p_time:'13:30',p_reason:'Change of plans'}}]);
});
test('invalid request details never reach a provider or database',async()=>{
  for(const time of ['25:00','13:99','00:30 PM','1 PM'])assert.equal((await customerApi.rescheduleMyAppointment(appointmentId,'2026-11-02',time,'reason')).success,false);
  assert.equal((await customerApi.rescheduleMyAppointment(appointmentId,'2026-11-02','13:30','  ')).success,false);
  assert.equal(calls.length,0);
});
test('availability is scoped to the appointment rather than excluding its own occupied interval',async()=>{
  result=[{slot_time:'01:30 PM',available:true}];
  assert.deepEqual(await customerApi.getRescheduleSlots(appointmentId,'2026-11-02'),[{time:'01:30 PM',available:true}]);
  assert.deepEqual(calls[0].body,{p_appointment_id:appointmentId,p_date:'2026-11-02'});
});
test('approval sends immutable request ID and decision, never an arbitrary date or time',async()=>{
  result={id:requestId,status:'approved'};
  assert.equal((await staffApi.reviewRescheduleRequest(requestId,true)).request.status,'approved');
  assert.deepEqual(calls.at(-1),{path:'/rest/v1/rpc/review_appointment_reschedule',method:'POST',body:{p_request_id:requestId,p_approve:true,p_reason:null}});
  assert.equal(staffApi.rescheduleAppointment,undefined);
});
test('declining requires a reason before sending and retains normalized reason',async()=>{
  assert.equal((await staffApi.reviewRescheduleRequest(requestId,false,'  ')).success,false);
  assert.equal(calls.length,0);
  await staffApi.reviewRescheduleRequest(requestId,false,' Please choose another day ');
  assert.equal(calls.at(-1).body.p_reason,'Please choose another day');
});
test('customer and inactive staff cannot call staff review through the API',async()=>{
  role='customer';await assert.rejects(staffApi.reviewRescheduleRequest(requestId,true));
  role='admin';active=false;await assert.rejects(staffApi.reviewRescheduleRequest(requestId,true));
  assert.equal(calls.some((call)=>call.path.endsWith('review_appointment_reschedule')),false);
});
test('user-confirmed active Head approval boundary remains available',async()=>{
  role='head';await staffApi.reviewRescheduleRequest(requestId,true);
  assert.equal(calls.at(-1).path,'/rest/v1/rpc/review_appointment_reschedule');
});
test('server rejection is shown and no approval is automatically retried',async()=>{
  responseStatus=403;result={code:'42501',message:'Appointment approval access required'};
  await assert.rejects(staffApi.reviewRescheduleRequest(requestId,true),/approval access required/);
  assert.equal(calls.filter((call)=>call.path.includes('/rpc/')).length,1);
});
test('stale and conflict outcomes are not presented as successful moves',()=>{
  for(const status of ['stale','conflicted','superseded'])assert.equal(rescheduleOutcome({status,resolution_reason:'Original unchanged'}).success,false);
  assert.equal(rescheduleOutcome({status:'approved'}).success,true);
  assert.equal(rescheduleOutcome({status:'rejected'}).success,true);
});
test('history selection preserves resolved records while locating the current pending request',()=>{
  const previous={id:'old',status:'superseded',created_at:'2026-10-25T00:00:00Z'};
  const pending={id:'new',status:'pending',created_at:'2026-10-25T01:00:00Z'};
  const appointment={reschedule_requests:[previous,pending]};
  assert.equal(pendingReschedule(appointment),pending);assert.equal(latestReschedule(appointment),pending);
  assert.deepEqual(appointment.reschedule_requests,[previous,pending]);
  assert.equal(pendingReschedule({reschedule_requests:[previous]}),null);
});
test('requested times are explicitly formatted in Manila rather than the host timezone',()=>{
  assert.match(requestedTimeLabel({requested_date:'2026-11-02',requested_time:'13:30:00'}),/1:30\s*PM/);
});
