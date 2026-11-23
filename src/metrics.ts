import { quantile } from './core.js';
export function createMetrics(root:HTMLElement, enabled:boolean) {
  let active=false, frame=0, lastFrame=0, start=0, nextSample=0;
  const frames:number[]=[],samples:any[]=[],tasks:{duration:number;startTime:number}[]=[],events:any[]=[],lcp:any[]=[],observers:PerformanceObserver[]=[];
  let mutationCount=0;
  const mutationObserver = enabled ? new MutationObserver(records=>{mutationCount+=records.length;}) : null;
  const observe=(type:string,callback:(entries:PerformanceEntry[])=>void,buffered=false)=>{
    if(!enabled || !PerformanceObserver.supportedEntryTypes.includes(type))return;
    const observer=new PerformanceObserver(list=>callback(list.getEntries()));
    observer.observe({type,buffered,...(type==='event'?{durationThreshold:16}:{})});observers.push(observer);
  };
  observe('largest-contentful-paint',entries=>lcp.push(...entries.map(e=>({startTime:e.startTime,size:(e as any).size}))),true);
  observe('longtask',entries=>{if(active)for(const e of entries)tasks.push({duration:e.duration,startTime:e.startTime});});
  observe('event',entries=>{if(active)for(const e of entries)events.push({name:e.name,duration:e.duration,interactionId:(e as any).interactionId,startTime:e.startTime});});
  const tick=(now:number)=>{
    if(!active)return;
    if(lastFrame)frames.push(now-lastFrame);lastFrame=now;
    if(enabled && now>=nextSample){ const memory=(performance as any).memory;samples.push({atMs:Math.max(0,performance.now()-start),heapMB:memory?memory.usedJSHeapSize/1048576:null,visibility:document.visibilityState});nextSample=now+1000; }
    frame=requestAnimationFrame(tick);
  };
  return {
    start(){active=true;start=performance.now();lastFrame=0;mutationObserver?.observe(root,{subtree:true,childList:true,characterData:true,attributes:true});if(enabled)frame=requestAnimationFrame(tick);},
    snapshot(){return {elapsedMs:performance.now()-start,mutationRecords:mutationCount};},
    stop(){
      const end=performance.now();if(mutationObserver)mutationCount+=mutationObserver.takeRecords().length;
      active=false;cancelAnimationFrame(frame);mutationObserver?.disconnect();for(const observer of observers)observer.disconnect();
      return {
        metrics:{elapsedMs:end-start,longTaskMs:enabled?tasks.reduce((s,t)=>s+t.duration,0):null,longTaskCount:enabled?tasks.length:null,frameP95Ms:enabled?quantile(frames,.95):null,peakHeapMB:quantile(samples.map(s=>s.heapMB).filter(n=>n!==null),1),mutationRecords:enabled?mutationCount:null,lcpMs:lcp.at(-1)?.startTime??null,trustedEventP95Ms:quantile(events.filter(e=>e.interactionId).map(e=>e.duration),.95)},
        samples,longTasks:tasks,eventTiming:events,
        support:{longtask:PerformanceObserver.supportedEntryTypes.includes('longtask'),event:PerformanceObserver.supportedEntryTypes.includes('event'),heap:Boolean((performance as any).memory)},
      };
    },
  };
}
