const BASE="https://api.trongrid.io";
const TIMEOUT=12000;
async function get(path){const h={Accept:"application/json"};if(process.env.TRONGRID_API_KEY)h["TRON-PRO-API-KEY"]=process.env.TRONGRID_API_KEY;const r=await fetch(`${BASE}${path}`,{headers:h,signal:AbortSignal.timeout?AbortSignal.timeout(TIMEOUT):undefined});if(!r.ok)throw new Error(`TronGrid HTTP ${r.status}`);return r.json();}
export function validateTronAddress(a){return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(String(a||"").trim());}
function hexToBase58(hex){
  try{
    const alphabet="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let h=String(hex||"").replace(/^41/,"");
    if(!/^[0-9a-fA-F]{40}$/.test(h)) return null;
    let n=BigInt("0x"+h), out="";
    while(n>0n){const r=Number(n%58n);out=alphabet[r]+out;n/=58n;}
    return "T"+out;
  }catch{return null;}
}
export async function analyzeTronAddress(address){
 const [acct,txs,trc20]=await Promise.all([
   get(`/v1/accounts/${address}`),
   get(`/v1/accounts/${address}/transactions?limit=200&only_confirmed=true&order_by=block_timestamp,desc`),
   get(`/v1/accounts/${address}/transactions/trc20?limit=200&only_confirmed=true&order_by=block_timestamp,desc`)
 ]);
 const native=Number(acct?.data?.[0]?.balance||0)/1e6;
 const normal=Array.isArray(txs?.data)?txs.data:[];
 const token=Array.isArray(trc20?.data)?trc20.data:[];
 const rowsById=new Map();
 for(const t of normal){const id=t?.txID||t?.transaction_id;if(id)rowsById.set(id,t);}
 for(const t of token){const id=t?.transaction_id||t?.txID;if(id&&!rowsById.has(id))rowsById.set(id,t);}
 const rows=[...rowsById.values()];
 const times=rows.map(x=>Number(x?.block_timestamp||0)).filter(Boolean);
 const peers=new Map();let incoming=0,outgoing=0;
 for(const t of rows){
   const value=t?.raw_data?.contract?.[0]?.parameter?.value||{};
   const from=t?.from||value?.owner_address||hexToBase58(value?.owner_address);
   const to=t?.to||value?.to_address||hexToBase58(value?.to_address);
   const ownIn=to===address, ownOut=from===address;
   if(ownOut) outgoing++;
   else if(ownIn) incoming++;
   const peer=ownOut?to:ownIn?from:null;
   if(peer&&peer!==address){
     const x=peers.get(peer)||{address:peer,incoming:0,outgoing:0,transfers:0,assets:[]};
     x[ownOut?"outgoing":"incoming"]++;x.transfers++;
     if(t?.token_info?.symbol&&!x.assets.includes(t.token_info.symbol))x.assets.push(t.token_info.symbol);
     peers.set(peer,x);
   }
 }
 const assets=new Map([["TRX",true]]);
 for(const t of token){const s=t?.token_info?.symbol;if(s)assets.set(s,true);}
 const recent=rows.sort((a,b)=>Number(b?.block_timestamp||0)-Number(a?.block_timestamp||0)).slice(0,50).map(t=>{
   const value=t?.raw_data?.contract?.[0]?.parameter?.value||{};
   const from=t?.from||value?.owner_address||hexToBase58(value?.owner_address);
   const to=t?.to||value?.to_address||hexToBase58(value?.to_address);
   return {hash:t?.txID||t?.transaction_id||null,direction:from===address?"outgoing":to===address?"incoming":"unknown",from,to,asset:t?.token_info?.symbol||"TRX",timestamp:t?.block_timestamp?new Date(t.block_timestamp).toISOString():null};
 });
 return {behavior:{transaction_count:rows.length,incoming_count:incoming,outgoing_count:outgoing,first_seen:times.length?new Date(Math.min(...times)).toISOString():null,last_seen:times.length?new Date(Math.max(...times)).toISOString():null,volume_native:native,native_balance:native,native_symbol:"TRX",contract_counterparties:0},assets:[...assets.keys()].slice(0,100).map(symbol=>({symbol})),recent_operations:recent,counterparties:[...peers.values()].sort((a,b)=>b.transfers-a.transfers).slice(0,50),sources:[{name:"TronGrid",checked_at:new Date().toISOString()}]};
}
