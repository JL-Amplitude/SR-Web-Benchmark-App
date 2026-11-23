import versions from '../package.json';
export const SDK_VERSIONS = versions.dependencies;
export type SDK = Awaited<ReturnType<typeof initSDK>>;
export async function initSDK(config: any, identity: {deviceId:string;sessionId:number}, note: (kind:string, detail:any)=>void) {
  let replay: any, analytics: any, plugin: any;
  const uploads: any[] = [],remoteConfigurations:any[]=[];
  const wantsReplay = ['standalone','plugin','paired'].includes(config.mode);
  if (config.mode !== 'none' && !config.apiKey.trim()) throw new Error('Enter a development project API key before using an SDK mode.');
  const options: any = {
    sampleRate:config.sampleRate,useWebWorker:config.worker,
    performanceConfig:{enabled:config.idle,timeout:config.idleTimeout,mergeMutations:config.merge,...(config.selectorTimeout?{interaction:{timeoutMs:config.selectorTimeout,maxNumberOfTries:10000,threshold:1000}}:{})},
    storeType:config.store,flushIntervalConfig:{minIntervalMs:config.flushMin,maxIntervalMs:config.flushMax},
    privacyConfig:{defaultMaskLevel:config.mask,blockSelector:['[data-private]',...(config.blockExpensive?['[data-expensive]']:[])]},
    captureFullSnapshotOnFocus:config.captureFocus,
  };
  if(config.telemetry) options.handleFetchConfig=async(request:any)=>{
    const response=await fetch(request.url,{method:request.method,headers:request.headers,signal:request.signal});
    try{const data=await response.clone().json();remoteConfigurations.push({atMs:performance.now(),status:response.status,sessionReplay:data?.configs?.sessionReplay??null});}catch{}
    return response;
  };
  if(config.telemetry) options.handleSendEvents = async (request:any) => {
    const body=request.body;
    const bytes=typeof body==='string'?new TextEncoder().encode(body).byteLength:body instanceof Blob?body.size:body?.byteLength??null;
    const record:any={atMs:performance.now(),bodyBytes:bytes,status:null,durationMs:null,failed:false};
    uploads.push(record);
    const start=performance.now();
    try { const response=await fetch(request.url,{method:request.method,headers:request.headers,body,keepalive:request.keepalive});record.status=response.status; return response; }
    catch(error) {record.failed=true;throw error;}
    finally {record.durationMs=performance.now()-start;}
  };
  performance.mark('sdk-import-start');
  if(config.mode==='plugin') {
    const modules=await Promise.all([import('@amplitude/analytics-browser'),import('@amplitude/plugin-session-replay-browser')]);
    analytics=modules[0].createInstance();plugin=modules[1].sessionReplayPlugin(options);
    analytics.add(plugin);
  } else {
    if(['analytics','paired'].includes(config.mode)) analytics=(await import('@amplitude/analytics-browser')).createInstance();
    if(wantsReplay) replay=await import('@amplitude/session-replay-browser');
  }
  performance.mark('sdk-import-end');performance.measure('sdk-import','sdk-import-start','sdk-import-end');
  performance.mark('sdk-init-start');
  if(analytics) await analytics.init(config.apiKey,undefined,{deviceId:identity.deviceId,sessionId:identity.sessionId,serverZone:config.zone,autocapture:false,defaultTracking:false,fetchRemoteConfig:false,logLevel:0,flushIntervalMillis:10000}).promise;
  if(replay) await replay.init(config.apiKey,{...options,...identity,serverZone:config.zone,logLevel:0}).promise;
  performance.mark('sdk-init-end');performance.measure('sdk-init','sdk-init-start','sdk-init-end');
  note('sdk-ready',{mode:config.mode,versions:SDK_VERSIONS});
  const properties=()=>plugin?.getSessionReplayProperties?.()??replay?.getSessionReplayProperties?.()??{};
  const track=(name:string,props:any={})=> {
    const eventProperties={...props,...properties(),bench_mode:config.mode,bench_workload:config.workload};
    if(analytics) { analytics.track(name,eventProperties); return; }
    // Standalone links its replay using the HTTP Events API; no Analytics SDK is loaded.
    if(config.mode==='standalone') {
      const url=config.zone==='EU'?'https://api.eu.amplitude.com/2/httpapi':'https://api2.amplitude.com/2/httpapi';
      void fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({api_key:config.apiKey,events:[{device_id:identity.deviceId,session_id:identity.sessionId,time:Date.now(),event_type:name,event_properties:eventProperties,insert_id:crypto.randomUUID()}]})}).then(r=>{if(!r.ok) note('event-link-error',{status:r.status});}).catch(()=>note('event-link-error',{message:'HTTP event request failed'}));
    }
  };
  return {
    uploads, remoteConfigurations, properties, track,
    flush:async()=>{await (plugin?.sessionReplay?.flush?.()??replay?.flush?.());await analytics?.flush?.().promise;},
    newSession:async()=>{identity.sessionId=Date.now();if(analytics)analytics.setSessionId(identity.sessionId);if(replay)await replay.setSessionId(identity.sessionId).promise;note('new-session',{...identity});},
    options:{...options,handleSendEvents:config.telemetry?'instrumented fetch wrapper':undefined},
  };
}
