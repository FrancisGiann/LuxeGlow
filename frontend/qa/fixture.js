import {useState} from 'react';
const params=new URLSearchParams(location.search);
const date=(offset)=>new Date(Date.now()+offset*86400000).toISOString().slice(0,10);
export const person={id:'10000000-0000-4000-8000-000000000001',first_name:'Synthetic',last_name:'Customer',email:'customer@synthetic.invalid',phone:'',role:'customer',is_active:true};
const request={id:'30000000-0000-4000-8000-000000000001',status:'pending',requested_date:date(3),requested_time:'15:00:00',created_at:new Date().toISOString(),reason:'Schedule conflict: a synthetic customer requests an afternoon appointment. '+('Long reason to verify wrapping and dialog scrolling. '.repeat(6))};
export const appointment={id:'20000000-0000-4000-8000-000000000001',reference_no:'QA-SYNTHETIC-001',customer:person,staff_id:'40000000-0000-4000-8000-000000000001',staff_member_id:'40000000-0000-4000-8000-000000000001',staff_name:'Synthetic team member',local_date:date(2),local_time:'10:00:00',raw_date:date(2),raw_time:'10:00:00',start_at:`${date(2)}T10:00:00+08:00`,status:'Confirmed',total_duration_minutes:60,total_price:100,price:100,service:'Synthetic nail treatment',services:[{service_name:'Synthetic nail treatment'}],created_at:new Date().toISOString(),reschedule_requests:[request]};
export function useAuth(){return{customer:{...person,role:params.get('view')==='customer'?'customer':params.get('role')==='head'?'head':'admin'},logout:async()=>{},isAuthenticated:true};}
export function useDashboard(){const [,tick]=useState(0);return{appointments:[appointment],customer:person,loading:false,refresh:async()=>tick((n)=>n+1)};}
export function useStaffNotifications(){return{notifications:[],unreadCount:0,loading:false,error:'',markRead:async()=>{},markAllRead:async()=>{}};}
export const supabase=null;
export function requireSupabase(){throw new Error('No Supabase connection exists in this fixture');}
export const publicServiceImage=()=>'';
export const fixtureConflict=params.get('outcome')==='conflict';

if(params.get('requests')==='none')appointment.reschedule_requests=[];
