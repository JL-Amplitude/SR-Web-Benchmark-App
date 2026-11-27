import { normalize } from './core.js';

export const METRICS = [
  {key:'elapsedMs',name:'Measured duration',unit:'ms',description:'Length of the timed workload window. SDK initialization and the later upload drain are measured separately. A longer duration is not itself a regression.'},
  {key:'longTaskMs',name:'Total long-task time',unit:'ms',description:'Sum of the full duration of browser long-task entries during the workload, including application and instrumentation work. This is not Total Blocking Time and is not attributed to Replay.'},
  {key:'longTaskCount',name:'Long tasks',unit:'count',description:'Number of browser-reported long tasks during the workload. Compare the same actions and duration with a matched baseline; zero does not prove zero SDK cost.'},
  {key:'frameP95Ms',name:'Frame-gap p95',unit:'ms',description:'95th percentile of recorded animation-frame gaps. Roughly 95% of gaps are at or below this value. Background throttling and display refresh rate affect it; this is not an attributed dropped-frame count.'},
  {key:'peakHeapMB',name:'Peak sampled JS heap',unit:'MB',description:'Highest available JavaScript heap sample during the workload. Sampling can miss brief peaks. It excludes full process and GPU memory and is only available in supporting browsers.'},
  {key:'mutationRecords',name:'Observed mutation records',unit:'count',description:'MutationObserver records from the workload subtree. A record is not necessarily one DOM node change or one Replay event. Instrumentation must be enabled to collect this.'},
  {key:'lcpMs',name:'Observed LCP',unit:'ms',description:'Latest recorded Largest Contentful Paint timestamp relative to page navigation, not the timed workload start. Keep load conditions fixed; this lab observation is not a field percentile.'},
  {key:'trustedEventP95Ms',name:'Trusted event timing p95',unit:'ms',description:'95th percentile of captured Event Timing durations with an interaction ID. The browser reports only eligible events above its threshold. Built-in scripted actions do not establish real-user INP; no entries means unavailable.'},
  {key:'actualUpdatesPerSecond',name:'Achieved update rate',unit:'/s',description:'Executed inventory updates divided by measured seconds, applicable to Rapid updates and Poor connectivity. Compare with the configured target to detect scheduling loss; it is not the number of individual DOM mutations.'},
  {key:'uploadBodyBytesObserved',name:'Replay upload body bytes',unit:'bytes',description:'Sum of observed request-body sizes across upload attempts, including retries. Covers initialization, workload, and drain on this page. Usually compressed; excludes HTTP/TLS overhead and does not mean all bytes were successfully delivered.'},
];
export const finite = value => typeof value==='number' && Number.isFinite(value);
export const records = value => Array.isArray(value)?value.filter(x=>x && typeof x==='object' && !Array.isArray(x)):[];
export function metricValue(run,key){
  if(key==='actualUpdatesPerSecond' && !['updates','network'].includes(run.config?.workload))return null;
  const value=run.metrics?.[key];return finite(value)?value:null;
}
export function displayValue(value,unit=''){
  if(!finite(value))return 'Unavailable';
  const number=new Intl.NumberFormat('en',{maximumFractionDigits:unit==='count'?0:2}).format(value);
  if(unit==='count')return number;
  return `${number}${unit===' /s'||unit==='/s'?' /s':unit?' '+unit:''}`;
}
export function validateResult(run){
  if(!run || Array.isArray(run) || run.schemaVersion!==1 || typeof run.runId!=='string'||!run.runId.trim())throw new Error('Expected a Amplitude SDK Performance Bench result with schemaVersion 1 and a run ID.');
  for(const key of ['config','metrics','replay','environment'])if(!run[key]||typeof run[key]!=='object'||Array.isArray(run[key]))throw new Error(`Run ${run.runId}: missing or invalid ${key}.`);
  normalize({...run.config,apiKey:''});
  for(const {key}of METRICS)if(run.metrics[key]!=null && (!finite(run.metrics[key])||run.metrics[key]<0))throw new Error(`Run ${run.runId}: ${key} must be a non-negative number or null.`);
  for(const key of ['samples','longTasks','eventTiming','uploads','history','segments','resources','performanceMeasures','remoteConfigurations','warnings','errors'])if(run[key]!==undefined&&!Array.isArray(run[key]))throw new Error(`Run ${run.runId}: ${key} must be an array.`);
  return run;
}
export function parseResults(text){
  const parsed=JSON.parse(text),runs=Array.isArray(parsed)?parsed:[parsed];
  if(!runs.length)throw new Error('The JSON file contains no runs.');
  return runs.map(validateResult);
}
export function mergeRuns(incoming,existing){
  const map=new Map();for(const run of [...incoming,...existing])if(!map.has(run.runId))map.set(run.runId,run);return [...map.values()];
}
export function timedPoints(values,xKey,yKey,origin=0){
  return records(values).filter(row=>finite(row[xKey])&&finite(row[yKey])).map(row=>({x:(row[xKey]-origin)/1000,y:row[yKey]}));
}
export function runOrigin(run){const starts=records(run.history).filter(row=>row.kind==='run-start'&&finite(row.atMs));return starts.at(-1)?.atMs??null;}
