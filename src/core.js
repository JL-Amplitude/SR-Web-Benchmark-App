export const WORKLOADS = [
  { id: 'journey', name: 'Typical journey', tag: 'Representative', icon: '◈', seconds: 60, description: 'Browse, search, inspect a product, and complete a synthetic checkout.' },
  { id: 'large', name: 'Large screen', tag: 'DOM complexity', icon: '▦', seconds: 30, description: 'An exact-size subtree of 500, 2,000, or 10,000 element nodes.' },
  { id: 'updates', name: 'Rapid updates', tag: 'Mutation throughput', icon: '≋', seconds: 60, description: 'A seeded live market table with a fixed update rate and measured throughput.' },
  { id: 'scroll', name: 'Scroll & animation', tag: 'Frame pacing', icon: '↕', seconds: 60, description: 'A long catalog, repeated scrolling, expanding cards, and continuous animation.' },
  { id: 'complex', name: 'Complex interaction', tag: 'Selector cost', icon: '⌘', seconds: 60, description: 'Deeply nested buttons, wide sibling sets, and repeated form inputs.' },
  { id: 'lifecycle', name: 'Lifecycle', tag: 'Session handling', icon: '⟳', seconds: 60, description: 'Hash navigation and real focus, visibility, reload, and session-change evidence.' },
  { id: 'network', name: 'Poor connectivity', tag: 'Buffer & recover', icon: '⌁', seconds: 360, description: 'A live feed during slow upload, five minutes offline, and reconnection.' },
  { id: 'soak', name: 'Long session', tag: 'Sustained load', icon: '◷', seconds: 1800, description: 'Repeat the same shopping journey for 30 minutes and track resource trends.' },
];
export const DEFAULT_CONFIG = {
  mode: 'none', workload: 'journey', seed: 42, seconds: 60,
  nodes: 2000, updateHz: 10, depth: 30, sampleRate: 1,
  apiKey: '', zone: 'EU', worker: true, idle: true, idleTimeout: 2000,
  merge: true, selectorTimeout: 0, store: 'memory', flushMin: 1000, flushMax: 10000,
  mask: 'medium', blockExpensive: false, init: 'immediate',
  captureFocus: false, driver: 'internal', telemetry: true,
};
export function normalize(input = {}) {
  const c = { ...DEFAULT_CONFIG, ...input };
  const enums = { mode: ['none','analytics','standalone','plugin','paired'], workload: WORKLOADS.map(w=>w.id), zone:['US','EU'], store:['memory','idb'],mask:['light','medium','conservative'],init:['immediate','after-load'],driver:['internal','external'] };
  for (const [key, values] of Object.entries(enums)) if (!values.includes(c[key])) throw new Error(`Invalid ${key}`);
  for (const [key, min, max] of [['seed',1,2147483647],['seconds',1,7200],['nodes',500,10000],['updateHz',1,60],['depth',1,200],['sampleRate',0,1],['idleTimeout',1,30000],['selectorTimeout',0,1000],['flushMin',100,60000],['flushMax',100,120000]]) {
    c[key] = Number(c[key]);
    if (!Number.isFinite(c[key]) || c[key] < min || c[key] > max) throw new Error(`Invalid ${key}: expected ${min}–${max}`);
  }
  for (const key of ['seed','seconds','nodes','updateHz','depth','idleTimeout','selectorTimeout','flushMin','flushMax']) c[key] = Math.floor(c[key]);
  if (![500,2000,10000].includes(c.nodes)) throw new Error('Choose 500, 2000 or 10000 nodes');
  if(c.flushMax < c.flushMin) throw new Error('Maximum flush interval must be at least the minimum');
  for(const key of ['worker','idle','merge','blockExpensive','captureFocus','telemetry']) if(typeof c[key] !== 'boolean') throw new Error(`Invalid ${key}`);
  if(typeof c.apiKey !== 'string') throw new Error('Invalid API key');
  return c;
}
export function rng(seed) { let x = seed >>> 0; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; }; }
export function products(seed, count = 24) {
  const random = rng(seed), names = ['Field notebook','Studio headphones','Everyday backpack','Desk light','Travel tumbler','Canvas organizer'];
  return Array.from({length:count},(_,i)=>({id:i+1,name:`${names[i % names.length]} ${String(i+1).padStart(2,'0')}`,price:25+Math.floor(random()*175),stock:Math.floor(random()*90)+10,color:['lavender','mint','peach','blue'][i%4]}));
}
export function quantile(values,p) { if (!values.length) return null; const a=[...values].sort((a,b)=>a-b), i=(a.length-1)*p, lo=Math.floor(i); return a[lo]+(a[Math.ceil(i)]-a[lo])*(i-lo); }
export function publicConfig(config) { const {apiKey,...rest}=config; return {...rest,apiKeyProvided:Boolean(apiKey)}; }
export function compare(base, candidate) {
  const dimensions=['workload','seed','seconds','nodes','updateHz','depth','driver','telemetry'];
  const reasons=dimensions.filter(k=>base.config[k]!==candidate.config[k]).map(k=>`Different ${k}`);
  if(base.environment.userAgent!==candidate.environment.userAgent) reasons.push('Different browser/OS');
  if(JSON.stringify(base.environment.viewport)!==JSON.stringify(candidate.environment.viewport)) reasons.push('Different viewport');
  return { warnings:reasons, metrics:['elapsedMs','longTaskMs','frameP95Ms','peakHeapMB'].map(key=>({key,baseline:base.metrics[key],candidate:candidate.metrics[key],delta:base.metrics[key]==null||candidate.metrics[key]==null?null:candidate.metrics[key]-base.metrics[key]})) };
}
