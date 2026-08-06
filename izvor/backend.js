// backend.js — portovana logika iz topologija-mreze.html (repo: tigor13061306/topologija-mreze)
// Isti model podataka i isti storage ključ 'topo_state' -> redizajn i original dijele iste podatke.

let _uid = 0;
export function uid(){ return 'net' + Date.now().toString(36) + (_uid++); }

export const NETCOLORS = ['#185fa5','#534ab7','#0f6e56','#ba7517','#b5396f','#2a6f97','#9c6b1e','#1f7a55','#7a3b8c','#444441'];
export const EQUIP_TYPES = ['Firewall','Ruter','Master svič','Svič','Access point','DVR/NVR snimač','Server','Patch panel','UPS','Modem','Konverter (media)','Ostalo'];

export function mkNet(name,color){
  return {id:uid(),name:name||'Mreža',color:color||NETCOLORS[0],range:'',gw:'',gwAuto:true,primary:'mpls',vlan:'',vlanAuto:true,port:'',note:'',network:'',broadcast:'',hosts:''};
}
export function defaultNets(){ return [ mkNet('Trust','#185fa5'), mkNet('Video nadzor','#534ab7'), mkNet('LILD','#0f6e56') ]; }

export function normNet(s,i){
  s=s||{};
  const nm=s.name||('Mreža '+(i+1));
  let prim=s.primary;
  if(prim!=='mpls'&&prim!=='sdh'){ prim=/lild/i.test(nm)?'sdh':'mpls'; }
  const oldGw=(s.gw!==undefined?s.gw:(s.gwOpt!==undefined?s.gwOpt:''));
  let gwAuto;
  if(s.gwAuto!==undefined) gwAuto=s.gwAuto;
  else if(s.gwAutoOpt!==undefined) gwAuto=s.gwAutoOpt;
  else gwAuto=oldGw?false:true;
  return {
    id:s.id||uid(), name:nm, color:s.color||NETCOLORS[i%NETCOLORS.length],
    range:s.range||'', gw:oldGw, gwAuto:gwAuto, primary:prim,
    vlan:s.vlan||'', port:s.port||'', note:s.note||'',
    vlanAuto:(s.vlanAuto!==undefined?s.vlanAuto:(s.vlan?false:true)),
    network:s.network||'', broadcast:s.broadcast||'', hosts:(s.hosts!==undefined?s.hosts:'')
  };
}
export function migrateNets(old){
  if(Array.isArray(old)) return old.map((s,i)=>normNet(s,i));
  old=old||{};
  if(old.data!==undefined||old.opt!==undefined||old.video!==undefined||old.lild!==undefined||old.dhcp!==undefined){
    const out=[];
    const base=old.data||old.opt; if(base!==undefined) out.push(normNet(Object.assign({name:'Računari',color:'#185fa5'},base),0));
    if(old.video!==undefined) out.push(normNet(Object.assign({name:'Video nadzor',color:'#534ab7'},old.video),1));
    if(old.lild!==undefined) out.push(normNet(Object.assign({name:'LILD',color:'#0f6e56'},old.lild),2));
    return out.length?out:defaultNets();
  }
  return defaultNets();
}
export function normEquip(e){ e=e||{};
  return {id:e.id||('eq'+Math.random().toString(36).slice(2)),etype:e.etype||'',vendor:e.vendor||'',model:e.model||e.name||'',serial:e.serial||'',barcode:e.barcode||'',ip:e.ip||'',firmware:e.firmware||'',rack:e.rack||'',location:e.location||'',netId:e.netId||'',upstream:e.upstream||'',photo:e.photo||'',note:e.note||''};
}
function norm(n){
  n.address=n.address||'';
  n.gwMpls=n.gwMpls||''; n.gwSdh=n.gwSdh||'';
  if(n.type==='server'){
    n.equipment=(n.equipment||[]).map(normEquip);
    n.nets=migrateNets(n.nets||[]);
    n.devices=n.devices||[];
    return n;
  }
  n.nets=migrateNets(n.nets);
  n.equipment=(n.equipment||[]).map(normEquip);
  n.devices=(n.devices||[]).map(d=>{ d=d||{}; if('net'in d) delete d.net;
    return {id:d.id||('d'+Math.random().toString(36).slice(2)),dtype:d.dtype||'Računar',floor:d.floor||'',office:d.office||'',name:d.name||'',barcode:d.barcode||'',ip:d.ip||'',netId:d.netId||'',uplink:d.uplink||''}; });
  const ids=n.nets.map(z=>z.id); n.devices.forEach(d=>{ if(d.netId && !ids.includes(d.netId)) d.netId=''; });
  return n;
}
export function normState(s){
  Object.values(s.nodes).forEach(norm);
  s.edges=(s.edges||[]).map(e=>({from:e.from,to:e.to,ipMpls:e.ipMpls||'',gwMpls:e.gwMpls||'',ipSdh:e.ipSdh||'',gwSdh:e.gwSdh||''}));
  s.seq=s.seq||0;
  s.meta=Object.assign({company:'',hq:'',docTitle:'',author:'',role:'',contact:'',updated:'',version:'',notes:''}, s.meta||{});
  s.deviceTypes=Array.isArray(s.deviceTypes)&&s.deviceTypes.length?s.deviceTypes:['Računar','Laptop','Printer','Telefon','Kamera','Access point','Server','Ostalo'];
  s.floors=Array.isArray(s.floors)&&s.floors.length?s.floors:['Prizemlje','Prvi sprat','Drugi sprat'];
  s.vendors=Array.isArray(s.vendors)?s.vendors:['Cisco','Fortinet','MikroTik','HP','Huawei','Ubiquiti'];
  Object.values(s.nodes).forEach(nd=>{ (nd.devices||[]).forEach(d=>{ if(d.floor && !s.floors.includes(d.floor)) s.floors.push(d.floor); }); });
  Object.values(s.nodes).forEach(nd=>{ (nd.devices||[]).forEach(d=>{ if(d.dtype && !s.deviceTypes.includes(d.dtype)) s.deviceTypes.push(d.dtype); }); });
  return s;
}

// ---- CIDR / IP ----
export function ipToInt(ip){ const p=String(ip).split('.'); if(p.length!==4)return null; let v=0; for(const o of p){ if(!/^\d{1,3}$/.test(o))return null; const x=+o; if(x>255)return null; v=v*256+x; } return v>>>0; }
export function intToIp(v){ return [(v>>>24)&255,(v>>>16)&255,(v>>>8)&255,v&255].join('.'); }
export function maskToPrefix(maskStr){
  const v=ipToInt(maskStr); if(v===null) return null;
  let bits=0, seenZero=false;
  for(let i=31;i>=0;i--){ const b=(v>>>i)&1; if(b===1){ if(seenZero) return null; bits++; } else seenZero=true; }
  return bits;
}
export function computeNet(cidr){
  if(!cidr) return {ok:false,empty:true};
  const str=String(cidr).trim();
  let ipStr=null, n=null;
  let m=str.match(/^(\d+\.\d+\.\d+\.\d+)\s*\/\s*(\d+)$/);
  if(m){ ipStr=m[1]; n=+m[2]; }
  else { const m2=str.match(/^(\d+\.\d+\.\d+\.\d+)[\s,\/]+(\d+\.\d+\.\d+\.\d+)$/); if(m2){ ipStr=m2[1]; n=maskToPrefix(m2[2]); } }
  if(ipStr===null||n===null) return {ok:false};
  const ip=ipToInt(ipStr); if(ip===null||n<0||n>32) return {ok:false};
  const mask=n===0?0:((0xFFFFFFFF<<(32-n))>>>0);
  const network=(ip&mask)>>>0; const broadcast=(network|((~mask)>>>0))>>>0;
  let first,last,hosts;
  if(n===32){ first=last=network; hosts=1; }
  else if(n===31){ first=network; last=broadcast; hosts=2; }
  else { first=(network+1)>>>0; last=(broadcast-1)>>>0; hosts=broadcast-network-1; }
  return {ok:true, prefix:n, network:intToIp(network), broadcast:intToIp(broadcast), first:intToIp(first), last:intToIp(last), hosts};
}
export function derivedText(net){
  const c=computeNet(net.range);
  if(c.empty) return 'Upiši opseg u CIDR formatu (npr. 10.1.10.0/24).';
  if(!c.ok) return '⚠ Neispravan CIDR.';
  return 'Mreža '+c.network+' · Brodkast '+c.broadcast+' · '+c.hosts+' host. ('+c.first+'–'+c.last+')';
}
export function ipInRange(ip,cidr){
  const c=computeNet(cidr); if(!c.ok) return {ok:false,reason:'noNet'};
  const v=ipToInt(ip); if(v===null) return {ok:false,reason:'badIp'};
  const f=ipToInt(c.first), l=ipToInt(c.last);
  if(v>=f && v<=l) return {ok:true};
  if(ip===c.network||ip===c.broadcast) return {ok:false,reason:'reserved'};
  return {ok:false,reason:'outside'};
}

// ---- seed ----
export const seed = () => normState({
  nodes:{
    hq:{id:'hq',name:'Centralni firewall (HQ)',address:'',x:660,y:70,type:'hq',nets:defaultNets(),devices:[]},
    l1:{id:'l1',name:'Lokacija 1',address:'',x:360,y:440,type:'loc',nets:defaultNets(),devices:[]},
    l2:{id:'l2',name:'Lokacija 2',address:'',x:960,y:440,type:'loc',nets:defaultNets(),devices:[]},
  },
  edges:[{from:'hq',to:'l1'},{from:'hq',to:'l2'}], seq:2
});

// ---- storage: isti ključ 'topo_state' kao original; localStorage fallback za preview ----
const KEY = 'topo_state';
let mem = null;
export async function load(){
  try{ if(typeof window!=='undefined' && window.storage){ const r=await window.storage.get(KEY); if(r&&r.value) return normState(JSON.parse(r.value)); } }catch(e){}
  try{ const raw=localStorage.getItem(KEY); if(raw) return normState(JSON.parse(raw)); }catch(e){}
  return mem;
}
export async function save(state){
  const s=JSON.stringify(state); mem=state;
  try{ if(typeof window!=='undefined' && window.storage) await window.storage.set(KEY,s); }catch(e){}
  try{ localStorage.setItem(KEY,s); }catch(e){}
}

export function ensureServer(state){
  if(!state||!state.nodes) return state;
  const has = Object.values(state.nodes).some(n=>n.type==='server');
  if(!has){
    state.nodes.srv = normEquip ? { id:'srv', name:'Server soba', address:'', x:600, y:40, type:'server', gwMpls:'', gwSdh:'', nets:[], devices:[], equipment:[] } : state.nodes.srv;
    state.edges = state.edges||[];
    if(!state.edges.some(e=>e.to==='srv'||e.from==='srv')) state.edges.push({from:'hq',to:'srv',ipMpls:'',gwMpls:'',ipSdh:'',gwSdh:''});
  }
  return state;
}

// Učitaj postojeće ili posij demo podatke (bogatiji seed za pregled redizajna).
export async function loadOrSeed(){
  const existing = await load();
  if(existing && existing.nodes && Object.keys(existing.nodes).length) return ensureServer(existing);
  return demoState();
}

// Demo state s realnim imenima/opsezima radi prikaza (upisuje se tek na eksplicitni save).
export function demoState(){
  const s = seed();
  const setNets = (node, defs) => {
    node.nets = defs.map((d,i)=>normNet(d,i));
  };
  s.nodes.hq.address = 'Centrala · Banja Luka';
  s.nodes.hq.gwMpls='10.255.0.1'; s.nodes.hq.gwSdh='10.255.9.1';
  setNets(s.nodes.hq, [
    {name:'Trust', color:'#185fa5', range:'10.10.0.0/24', gw:'10.10.0.1', primary:'mpls', vlan:'10', port:'port1'},
    {name:'Video nadzor', color:'#534ab7', range:'10.10.9.0/24', gw:'10.10.9.1', primary:'mpls', vlan:'90', port:'port3'},
  ]);
  s.nodes.l1.address='Vuka Karadžića 1, Banja Luka';
  s.nodes.l1.gwMpls='10.255.1.1'; s.nodes.l1.gwSdh='10.255.10.1';
  setNets(s.nodes.l1, [
    {name:'Trust', color:'#185fa5', range:'10.20.1.0/24', gw:'10.20.1.1', primary:'mpls', vlan:'10', port:'port1'},
    {name:'Video nadzor', color:'#534ab7', range:'10.20.9.0/24', gw:'10.20.9.1', primary:'mpls', vlan:'90', port:'port3'},
    {name:'LILD', color:'#0f6e56', range:'172.16.24.0/24', gw:'172.16.24.1', primary:'sdh', vlan:'240', port:'port5'},
  ]);
  s.nodes.l1.devices = [
    {id:'d1',dtype:'Računar',floor:'Prizemlje',office:'Šalter 1',name:'PC-SALTER-01',barcode:'PS-100241',ip:'10.20.1.24',netId:s.nodes.l1.nets[0].id,uplink:'SW-PRIZ-1 / p12'},
    {id:'d2',dtype:'Računar',floor:'Prizemlje',office:'Šalter 2',name:'PC-SALTER-02',barcode:'PS-100242',ip:'10.20.1.25',netId:s.nodes.l1.nets[0].id,uplink:'SW-PRIZ-1 / p13'},
    {id:'d3',dtype:'Printer',floor:'Prizemlje',office:'Šalter 1',name:'HP-LJ-PRIZ',barcode:'PS-100310',ip:'10.20.1.60',netId:s.nodes.l1.nets[0].id,uplink:'SW-PRIZ-1 / p20'},
    {id:'d4',dtype:'Telefon',floor:'Prvi sprat',office:'Kancelarija 12',name:'VOIP-12',barcode:'PS-100455',ip:'10.20.1.101',netId:s.nodes.l1.nets[0].id,uplink:'SW-SPRAT1 / p4'},
    {id:'d5',dtype:'Računar',floor:'Prvi sprat',office:'Kancelarija 12',name:'PC-KANC-12',barcode:'PS-100256',ip:'10.20.1.31',netId:s.nodes.l1.nets[0].id,uplink:'SW-SPRAT1 / p5'},
    {id:'d6',dtype:'Kamera',floor:'Prvi sprat',office:'Hodnik',name:'CAM-HODNIK-1',barcode:'PS-100501',ip:'10.20.9.11',netId:s.nodes.l1.nets[1].id,uplink:'NVR-1 / p1'},
    {id:'d7',dtype:'Kamera',floor:'Prizemlje',office:'Ulaz',name:'CAM-ULAZ',barcode:'PS-100502',ip:'10.20.9.12',netId:s.nodes.l1.nets[1].id,uplink:'NVR-1 / p2'},
    {id:'d8',dtype:'Access point',floor:'Drugi sprat',office:'Sala',name:'AP-SALA',barcode:'PS-100388',ip:'10.20.1.150',netId:s.nodes.l1.nets[0].id,uplink:'SW-SPRAT2 / p8'},
  ];
  s.nodes.l2.address='Kralja Petra 12, Prijedor';
  s.nodes.l2.gwMpls='10.255.2.1'; s.nodes.l2.gwSdh='10.255.11.1';
  setNets(s.nodes.l2, [
    {name:'Trust', color:'#185fa5', range:'10.30.1.0/24', gw:'10.30.1.1', primary:'mpls', vlan:'10', port:'port1'},
    {name:'LILD', color:'#0f6e56', range:'172.16.24.0/24', gw:'172.16.24.1', primary:'sdh', vlan:'240', port:'port5'},
  ]);
  s.nodes.l2.devices = [
    {id:'d9',dtype:'Laptop',floor:'Drugi sprat',office:'Kancelarija 21',name:'LT-KANC-21',barcode:'PS-100277',ip:'10.30.1.44',netId:s.nodes.l2.nets[0].id,uplink:'AP-SALA (wifi)'},
    {id:'d10',dtype:'Računar',floor:'Drugi sprat',office:'Kancelarija 21',name:'PC-KANC-21',barcode:'PS-100259',ip:'10.30.1.45',netId:s.nodes.l2.nets[0].id,uplink:'SW-SPRAT2 / p9'},
  ];
  // svičevi po lokaciji (oprema) — za "Povezan na" izbor
  s.nodes.l1.equipment = [
    normEquip({etype:'Svič',vendor:'Cisco',model:'SW-PRIZ-1',serial:'FOC1234',ip:'10.20.1.2',rack:'Prizemlje / orman'}),
    normEquip({etype:'Svič',vendor:'Cisco',model:'SW-SPRAT1',serial:'FOC1235',ip:'10.20.1.3',rack:'1. sprat / orman'}),
    normEquip({etype:'Svič',vendor:'Cisco',model:'SW-SPRAT2',serial:'FOC1236',ip:'10.20.1.4',rack:'2. sprat / orman'}),
  ];
  // Server soba kao stvarni čvor (oprema: firewall, svičevi, DVR, UPS)
  s.nodes.srv = { id:'srv', name:'Server soba', address:'Centrala · server soba', x:600, y:40, type:'server',
    gwMpls:'', gwSdh:'', nets:[], devices:[], equipment:[
      normEquip({etype:'Firewall',vendor:'Fortinet',model:'FortiGate 100F',serial:'FGT100F-001',ip:'10.10.0.1',firmware:'7.2.5',rack:'R1 U1'}),
      normEquip({etype:'Master svič',vendor:'Cisco',model:'Catalyst 9300',serial:'CAT9300-01',ip:'10.10.0.2',firmware:'17.9',rack:'R1 U3'}),
      normEquip({etype:'Svič',vendor:'Cisco',model:'Catalyst 2960',serial:'CAT2960-07',ip:'10.10.0.3',rack:'R1 U5'}),
      normEquip({etype:'DVR/NVR snimač',vendor:'Hikvision',model:'DS-7716NI',serial:'HK-7716-02',ip:'10.10.9.5',rack:'R2 U4'}),
      normEquip({etype:'UPS',vendor:'APC',model:'Smart-UPS 3000',serial:'APC-3000-01',rack:'R2 U10'}),
    ] };
  s.edges.push({from:'hq',to:'srv',ipMpls:'',gwMpls:'',ipSdh:'',gwSdh:''});
  s.meta = Object.assign(s.meta, {
    company:'Pošte Srpske a.d.', hq:'Vuka Karadžića 1, Banja Luka',
    docTitle:'Topologija mreže — WAN', author:'Mrežni inženjer', role:'Mrežni inženjer',
    version:'2.0', updated:'31.07.2026.'
  });
  return s;
}
