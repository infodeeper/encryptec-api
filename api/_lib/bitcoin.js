const BASE="https://blockstream.info/api";
const TIMEOUT=12000;
function sig(){return AbortSignal.timeout?AbortSignal.timeout(TIMEOUT):undefined;}
async function get(path){const r=await fetch(`${BASE}${path}`,{signal:sig()});if(!r.ok)throw new Error(`Blockstream HTTP ${r.status}`);return r.json();}
export function validateBitcoinAddress(a){return /^(bc1[ac-hj-np-z02-9]{11,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,39}|tb1[ac-hj-np-z02-9]{11,87})$/.test(a);}
export async function analyzeBitcoinAddress(address){
 const info=await get(`/address/${encodeURIComponent(address)}`); const txs=await get(`/address/${encodeURIComponent(address)}/txs`);
 const funded=Number(info?.chain_stats?.funded_txo_sum||0), spent=Number(info?.chain_stats?.spent_txo_sum||0);
 const first=txs.length?Math.min(...txs.map(t=>Number(t?.status?.block_time||0)).filter(Boolean)):null; const last=txs.length?Math.max(...txs.map(t=>Number(t?.status?.block_time||0)).filter(Boolean)):null;
 const peers=new Map();
 for(const tx of txs){const vin=Array.isArray(tx?.vin)?tx.vin:[],vout=Array.isArray(tx?.vout)?tx.vout:[]; for(const v of vin){for(const a of (v?.prevout?.scriptpubkey_address?[v.prevout.scriptpubkey_address]:[])){if(a!==address){const x=peers.get(a)||{address:a,incoming:0,outgoing:0,transfers:0};x.outgoing++;x.transfers++;peers.set(a,x);}}} for(const v of vout){const a=v?.scriptpubkey_address;if(a&&a!==address){const x=peers.get(a)||{address:a,incoming:0,outgoing:0,transfers:0};x.incoming++;x.transfers++;peers.set(a,x);}}}
 return {behavior:{transaction_count:Number(info?.chain_stats?.tx_count||txs.length),incoming_count:txs.filter(t=>t?.vin?.some(v=>v?.prevout?.scriptpubkey_address!==address)&&t?.vout?.some(v=>v?.scriptpubkey_address===address)).length,outgoing_count:txs.filter(t=>t?.vin?.some(v=>v?.prevout?.scriptpubkey_address===address)).length,first_seen:first?new Date(first*1000).toISOString():null,last_seen:last?new Date(last*1000).toISOString():null,volume_native:(funded+spent)/1e8,native_balance:(funded-spent)/1e8,native_symbol:"BTC",contract_counterparties:0},assets:[{symbol:"BTC"}],recent_operations:txs.slice(0,50).map(t=>({hash:t.txid,direction:t?.vout?.some(v=>v?.scriptpubkey_address===address)?"incoming":"outgoing",timestamp:t?.status?.block_time?new Date(t.status.block_time*1000).toISOString():null})),counterparties:[...peers.values()].sort((a,b)=>b.transfers-a.transfers).slice(0,50),sources:[{name:"Blockstream",checked_at:new Date().toISOString()}]};
}
