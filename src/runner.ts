import { BRAND } from './brand';
import './style.css';
import { DEFAULT_CONFIG, normalize, publicConfig, redactResult, WORKLOADS } from './core.js';
import { mountWorkload } from './workloads';
import { createMetrics } from './metrics';
import { initSDK, SDK_VERSIONS, type SDK } from './sdk';

declare global { interface Window { bench:any; } }
const app=document.querySelector<HTMLElement>('#runner')!;
app.innerHTML=`<header class="runner-bar"><a href="./" class="brand" aria-label="Amplitude SDK Performance Bench">${BRAND}</a><span id="run-status" role="status">Preparing workload</span><div class="runner-actions"><button id="run-start" class="primary" disabled>Start run</button><button id="run-stop" class="secondary" disabled>Stop & save</button><button id="run-export" class="secondary" disabled>Export JSON</button></div></header><div class="runner-context" id="context"></div><main id="workload" class="workload"></main><section id="result-summary" class="result-summary" hidden></section>`;
const root=document.querySelector<HTMLElement>('#workload')!,status=document.querySelector<HTMLElement>('#run-status')!;
const button=(id:string)=>document.querySelector<HTMLButtonElement>(id)!;
let config:any, sdk:SDK|undefined, workload:ReturnType<typeof mountWorkload>,measure:ReturnType<typeof createMetrics>,timer:any,finishTimer:any,startAt=0,active=false,result:any=null,ready=false,initializing=false;
let history:any[]=[],previousSegments:any[]=[],offsetMs=0;
let identity={deviceId:`bench-${crypto.randomUUID()}`,sessionId:Date.now()};
let runId=crypto.randomUUID();
const note=(kind:string,detail:any={})=>{
  if(history.length<2000)history.push({kind,atMs:performance.now(),visibility:document.visibilityState,detail});
  if(kind==='request-new-session')void sdk?.newSession();
  if(kind==='request-reload')checkpoint();
};
const runtimeErrors:string[]=[];
window.addEventListener('error',e=>{runtimeErrors.push(e.message);note('runtime-error',{message:e.message});});
window.addEventListener('unhandledrejection',e=>{const message=String(e.reason?.message??e.reason);runtimeErrors.push(message);note('runtime-error',{message});});
function env(){return {userAgent:navigator.userAgent,platform:navigator.platform,hardwareConcurrency:navigator.hardwareConcurrency,deviceMemoryGB:(navigator as any).deviceMemory??null,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},timeOrigin:performance.timeOrigin,visibility:document.visibilityState,connection:(navigator as any).connection?{effectiveType:(navigator as any).connection.effectiveType,rtt:(navigator as any).connection.rtt,downlink:(navigator as any).connection.downlink}:null};}
const environment=env();
function download(value:any,name:string){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function checkpoint(){
  if(!active){location.reload();return;}
  clearInterval(timer);clearTimeout(finishTimer);active=false;
  const segment={...measure.stop(),workload:workload.stats()};previousSegments.push(segment);offsetMs+=segment.metrics.elapsedMs;
  sessionStorage.setItem('bench-resume',JSON.stringify({runId,identity,offsetMs,previousSegments,history,config}));location.reload();
}
async function initialize(){
  if(initializing)return;initializing=true;
  try {
    config=normalize(JSON.parse(sessionStorage.getItem('bench-config')??JSON.stringify(DEFAULT_CONFIG)));
    const resumeRaw=sessionStorage.getItem('bench-resume');sessionStorage.removeItem('bench-resume');
    if(resumeRaw){const resume=JSON.parse(resumeRaw);config=normalize(resume.config);runId=resume.runId;identity=resume.identity;offsetMs=resume.offsetMs;previousSegments=resume.previousSegments;history=resume.history;note('reload-resume',{offsetMs});}
    workload=mountWorkload(root,config,note);measure=createMetrics(root,config.telemetry);
    document.querySelector('#context')!.textContent=`${WORKLOADS.find(w=>w.id===config.workload)!.name} / ${config.mode} / seed ${config.seed} / ${config.seconds}s / ${config.driver==='internal'?'scripted DOM actions':'external browser input'}`;
    if(config.init==='after-load'){if(document.readyState!=='complete')await new Promise(r=>addEventListener('load',r,{once:true}));await new Promise(r=>setTimeout(r,2000));}
    const started=performance.now();sdk=await initSDK(config,identity,note);const initializedMs=performance.now()-started;
    // Initialization success does not prove that remote configuration selected capture.
    note('capture-check',{replayProperties:sdk.properties(),initializedMs});
    ready=true;status.textContent=config.mode==='none'?'Baseline ready · no SDK loaded':`${config.mode} initialized · verify capture evidence`;
    button('#run-start').disabled=false;
    if(resumeRaw || new URL(location.href).searchParams.get('auto')==='1')start();
  }catch(error){status.textContent=`Setup failed: ${(error as Error).message}`;status.classList.add('error-text');note('setup-error',{message:(error as Error).message});window.bench.error=(error as Error).message;}
}
function start(){
  if(!ready||active||result)return;
  active=true;startAt=performance.now();measure.start();note('run-start',{offsetMs});
  sdk?.track('Benchmark Run Started',{bench_run_id:runId,seed:config.seed});
  status.textContent='Recording measurements · keep this tab visible';button('#run-start').disabled=true;button('#run-stop').disabled=false;
  timer=setInterval(()=>{if(active)workload.tick(performance.now()-startAt+offsetMs);},workload.intervalMs);
  finishTimer=setTimeout(()=>void finish('completed'),Math.max(0,config.seconds*1000-offsetMs));
}
async function finish(reason='stopped'){
  if(!active)return result;
  active=false;clearInterval(timer);clearTimeout(finishTimer);
  const measured=measure.stop(),stats=workload.stats(),properties=sdk?.properties()??{};
  status.textContent='Draining uploads (up to 15 seconds)…';button('#run-stop').disabled=true;
  sdk?.track('Benchmark Run Finished',{bench_run_id:runId,reason});
  const drainStart=performance.now();let drainStatus='completed';let timeout:any;
  try{await Promise.race([sdk?.flush(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('timeout')),15000);})]);}
  catch(error){drainStatus=String((error as Error).message);}
  finally{clearTimeout(timeout);}
  const warnings=[
    'Lab measurements only. CPU, total process memory, energy, wire bytes and playback quality require external tools.',
    'LCP is a page-load observation; run duration starts after SDK initialization. Initialization measures a separate window.',
    'Frame gaps include background throttling; inspect visibility events before comparing.',
    ...(config.driver==='internal'?['Programmatic clicks/input are untrusted; they do not establish real-user INP.']:[]),
    ...(!config.telemetry?['Telemetry disabled: instrumented long-task/frame/heap/upload metrics are unavailable.']:['Upload/config instrumentation uses custom transport callbacks; disable it for unmodified SDK transport profiling.']),
    ...(config.workload==='network'?['This page cannot throttle connectivity. Check external-driver and browser network evidence.']:[]),
    ...(Object.keys(properties).length===0 && ['standalone','plugin','paired'].includes(config.mode)?['No active replay ID observed at run end. Validate remote configuration, sampling and ingestion.']:[]),
    ...(previousSegments.length?['Reload created separate measurement segments. Top-level metrics cover the final segment; inspect segments for the full run.']:[]),
    ...(runtimeErrors.length?['Runtime errors occurred; inspect errors before using this run.']:[]),
  ];
  const uploads=sdk?.uploads??[];
  result={schemaVersion:1,appVersion:'1.0.0',runId,createdAt:new Date().toISOString(),reason,config:publicConfig(config),sdkVersions:SDK_VERSIONS,identity,environment,metrics:{...measured.metrics,actualUpdatesPerSecond:stats.updates/(measured.metrics.elapsedMs/1000),uploadBodyBytesObserved:config.telemetry?uploads.reduce((sum:number,u:any)=>sum+(u.bodyBytes??0),0):null},workload:stats,replay:{properties,uploadAttempts:config.telemetry?uploads.length:null,successfulUploads:config.telemetry?uploads.filter((u:any)=>u.status>=200&&u.status<300).length:null,playbackVerified:false},uploads,remoteConfigurations:sdk?.remoteConfigurations??[],drain:{status:drainStatus,elapsedMs:performance.now()-drainStart},samples:measured.samples,longTasks:measured.longTasks,eventTiming:measured.eventTiming,support:measured.support,history,errors:runtimeErrors,segments:previousSegments,warnings,performanceMeasures:performance.getEntriesByType('measure').map(m=>({name:m.name,duration:m.duration,startTime:m.startTime})),resources:performance.getEntriesByType('resource').map((r:any)=>({name:new URL(r.name).origin+new URL(r.name).pathname,initiatorType:r.initiatorType,duration:r.duration,transferSize:r.transferSize,encodedBodySize:r.encodedBodySize}))};
  result=redactResult(result,config.apiKey);
  try{const saved=JSON.parse(localStorage.getItem('bench-results')??'[]');localStorage.setItem('bench-results',JSON.stringify([result,...saved].slice(0,12)));}catch{result.warnings.push('Browser storage full/unavailable. Export JSON before leaving.');}
  try { const channel=new BroadcastChannel('replay-bench');channel.postMessage({type:'result',result});channel.close(); }catch{}
  status.textContent=`${reason==='completed'?'Run complete':'Run stopped'} · results saved`;button('#run-export').disabled=false;
  const summary=document.querySelector<HTMLElement>('#result-summary')!;summary.hidden=false;
  summary.textContent=`${(result.metrics.elapsedMs/1000).toFixed(1)}s measured · ${stats.ticks} workload ticks · ${result.replay.successfulUploads??'Unobserved'} successful Replay upload responses. Playback is not yet verified. Export the result, then verify its identity in Amplitude.`;
  return result;
}
button('#run-start').addEventListener('click',start);button('#run-stop').addEventListener('click',()=>void finish());button('#run-export').addEventListener('click',()=>download(result,`amplitude-sdk-performance-bench-${runId}.json`));
for(const kind of ['visibilitychange','focus','blur','online','offline','pageshow','pagehide','hashchange'])window.addEventListener(kind,()=>note(kind,{online:navigator.onLine,hash:location.hash}));
window.bench={get ready(){return ready;},get config(){return config?publicConfig(config):null;},get running(){return active;},get result(){return result;},get state(){return workload?.stats();},get replayProperties(){return sdk?.properties()??{};},start,stop:finish,newSession:()=>sdk?.newSession(),checkpoint,networkPhase:(phase:string)=>note('external-network-phase',{phase}),note};
void initialize();
