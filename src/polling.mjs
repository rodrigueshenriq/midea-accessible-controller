export function nextDelay(state){
 if(state.power==='on'&&state.running_status==='start'){
  const minutes=Number(state.remain_time);
  return Number.isFinite(minutes)&&minutes>=0&&minutes<=10?60000:300000;
 }
 // Occasional discovery also detects cycles started from the physical panel or SmartHome.
 return 1800000;
}
export async function pollDue(store,now=Date.now()){
 const plan=await store.load('poll-plan');return !plan||plan.next<=now;
}
