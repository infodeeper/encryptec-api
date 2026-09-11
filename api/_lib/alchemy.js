const MAX_PAGES = Math.max(1, Number(process.env.ALCHEMY_MAX_PAGES || 10));
const PAGE_SIZE = Math.min(1000, Math.max(1, Number(process.env.ALCHEMY_PAGE_SIZE || 100)));
const REQUEST_TIMEOUT_MS = Math.max(3000, Number(process.env.ALCHEMY_TIMEOUT_MS || 12000));
const NETWORK_ENV = { ethereum:"ALCHEMY_ETHEREUM_URL", polygon:"ALCHEMY_POLYGON_URL", arbitrum:"ALCHEMY_ARBITRUM_URL", base:"ALCHEMY_BASE_URL", bsc:"ALCHEMY_BSC_URL" };
const SYMBOLS = { ethereum:"ETH", bsc:"BNB", polygon:"MATIC", arbitrum:"ETH", base:"ETH" };
function timeoutSignal(ms){ return AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined; }
export function normalizeNetwork(value){ const n=String(value||"").trim().toLowerCase(); const a={eth:"ethereum",ethereum:"ethereum",mainnet:"ethereum",bsc:"bsc",bnb:"bsc","bnb chain":"bsc",polygon:"polygon",matic:"polygon",arbitrum:"arbitrum","arbitrum one":"arbitrum",base:"base",bitcoin:"bitcoin",btc:"bitcoin",tron:"tron",trx:"tron",solana:"solana",sol:"solana",auto:"auto","auto-detect":"auto"}; return a[n]||n; }
export function getAlchemyUrl(network){ const e=NETWORK_ENV[network]; if(e&&process.env[e]) return process.env[e]; if(network==="ethereum"&&process.env.ALCHEMY_URL) return process.env.ALCHEMY_URL; return null; }
async function rpc(url,method,params){ const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:Date.now(),method,params}),signal:timeoutSignal(REQUEST_TIMEOUT_MS)}); if(!r.ok) throw new Error(`Alchemy HTTP ${r.status}`); const d=await r.json(); if(d?.error) throw new Error(d.error.message||`Alchemy RPC error: ${d.error.code}`); return d?.result; }
export async function getNativeBalance(url,address){ const r=await rpc(url,"eth_getBalance",[address,"latest"]); return Number(BigInt(r||"0x0"))/1e18; }
export async function getTransfers(url,address,direction){ const all=[]; let pageKey; for(let page=0;page<MAX_PAGES;page++){ const p={fromBlock:"0x0",toBlock:"latest",category:["external","internal","erc20"],withMetadata:true,maxCount:`0x${PAGE_SIZE.toString(16)}`}; if(direction==="outgoing")p.fromAddress=address;else p.toAddress=address;if(pageKey)p.pageKey=pageKey; const r=await rpc(url,"alchemy_getAssetTransfers",[p]); const t=Array.isArray(r?.transfers)?r.transfers:[]; all.push(...t); if(!r?.pageKey||!t.length)break;pageKey=r.pageKey;} return all; }
export async function getCode(url,address){ try{const r=await rpc(url,"eth_getCode",[address,"latest"]);return r&&r!=="0x";}catch{return null;} }
export function validateEvmAddress(a){return /^0x[a-fA-F0-9]{40}$/.test(a);}
export function normalizeAddress(a){return String(a||"").trim();}
function ts(tx){return tx?.metadata?.blockTimestamp||null;}
export async function getEvmAnalysis(url,address,network){
 const [balance,outgoing,incoming]=await Promise.all([getNativeBalance(url,address),getTransfers(url,address,"outgoing"),getTransfers(url,address,"incoming")]);
 const all=[...incoming,...outgoing]; const times=all.map(ts).filter(Boolean).map(x=>new Date(x).getTime()).filter(Number.isFinite);
 const peers=new Map(); const assets=new Set(); const recent=[];
 function add(tx,dir){const peer=dir==="incoming"?tx?.from:tx?.to;if(tx?.asset)assets.add(String(tx.asset)); if(peer&&peer.toLowerCase()!==address.toLowerCase()){let x=peers.get(peer)||{address:peer,incoming:0,outgoing:0,transfers:0,assets:[]};x[dir]++;x.transfers++;if(tx?.asset&&!x.assets.includes(tx.asset))x.assets.push(tx.asset);peers.set(peer,x);} recent.push({hash:tx?.hash||null,direction:dir,from:tx?.from||null,to:tx?.to||null,asset:tx?.asset||null,value:tx?.value??null,timestamp:ts(tx)});}
 incoming.forEach(x=>add(x,"incoming")); outgoing.forEach(x=>add(x,"outgoing"));
 const ranked=[...peers.values()].sort((a,b)=>b.transfers-a.transfers).slice(0,50); const counterparties=await Promise.all(ranked.map(async x=>{const code=await getCode(url,x.address);return {...x,assets:x.assets.slice(0,10),entity_type:code===true?"contract":code===false?"wallet":"unknown"};}));
 const native=all.filter(x=>!x?.asset||x.asset===network||x.asset===SYMBOLS[network]).reduce((s,x)=>s+(Number.isFinite(Number(x?.value))?Math.max(0,Number(x.value)):0),0);
 return {behavior:{transaction_count:all.length,incoming_count:incoming.length,outgoing_count:outgoing.length,first_seen:times.length?new Date(Math.min(...times)).toISOString():null,last_seen:times.length?new Date(Math.max(...times)).toISOString():null,volume_native:native,native_balance:balance,native_symbol:SYMBOLS[network],contract_counterparties:counterparties.filter(x=>x.entity_type==="contract").length},assets:[...assets].slice(0,100).map(symbol=>({symbol})),recent_operations:recent.sort((a,b)=>new Date(b.timestamp||0)-new Date(a.timestamp||0)).slice(0,50),counterparties,sources:[{name:"Alchemy",checked_at:new Date().toISOString()}]};
}
