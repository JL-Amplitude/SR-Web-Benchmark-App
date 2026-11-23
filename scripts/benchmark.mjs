import { chromium } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { DEFAULT_CONFIG, normalize } from '../src/core.js';

const baseURL=process.env.BENCH_URL;
if(!baseURL){console.error('Set BENCH_URL to the hosted dashboard URL. Optional: AMPLITUDE_API_KEY, BENCH_CONFIG, REPETITIONS, MODES. See README.');process.exit(1);}
const overrides=process.env.BENCH_CONFIG?JSON.parse(await readFile(process.env.BENCH_CONFIG,'utf8')):{};
const repetitions=Number(process.env.REPETITIONS??1),modes=(process.env.MODES??'none,standalone,analytics,plugin').split(',');
if(!Number.isInteger(repetitions)||repetitions<1||repetitions>1000)throw new Error('Invalid REPETITIONS');
const browser=await chromium.launch({headless:process.env.HEADLESS==='1',channel:process.env.BROWSER_CHANNEL??'chrome'});
const directory=process.env.RESULTS_DIR??'benchmark-results';await mkdir(directory,{recursive:true});
async function trustedJourney(page){
  const state=await page.evaluate(()=>window.bench.state?.state);
  if(state==='browse'){const input=page.locator('[data-search]');await input.fill('notebook');await page.locator('[data-product]').first().click();}
  else if(state==='detail')await page.locator('[data-checkout]').click();
  else if(state==='form'){await page.locator('[name=name]').fill('Alex Sample');await page.locator('[name=email]').fill('alex@example.test');await page.locator('[name=note]').fill('Seeded browser-driven checkout');await page.getByRole('button',{name:'Place test order'}).click();}
  else if(state==='confirmation')await page.locator('[data-restart]').click();
}
try {
  for(let rep=0;rep<repetitions;rep++){
    // Balanced order across repetitions. Each run has a fresh browser context.
    const order=rep%2?[...modes].reverse():modes;
    for(const mode of order){
      const config=normalize({...DEFAULT_CONFIG,...overrides,mode,apiKey:process.env.AMPLITUDE_API_KEY??'',driver:'external',...(overrides.workload==='network'?{seconds:360}:{})});
      if(mode!=='none'&&!config.apiKey)throw new Error('Set AMPLITUDE_API_KEY for SDK modes. It is never written to results.');
      const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
      await context.addInitScript(config=>sessionStorage.setItem('bench-config',JSON.stringify(config)),config);
      const page=await context.newPage();await page.goto(new URL('runner.html',baseURL.endsWith('/')?baseURL:baseURL+'/').href);
      await page.waitForFunction(()=>window.bench?.ready||window.bench?.error,null,{timeout:45000});
      const error=await page.evaluate(()=>window.bench.error);if(error)throw new Error(error);
      const cdp=await context.newCDPSession(page);
      const phase=async(name,offline,upload,latency)=>{await cdp.send('Network.emulateNetworkConditions',{offline,latency,downloadThroughput:offline?0:1250000,uploadThroughput:upload});await page.evaluate(name=>window.bench.networkPhase(name),name);};
      if(config.workload==='network')await phase('slow-uplink',false,12500,150);
      await page.evaluate(()=>window.bench.start());console.log(`Running ${mode}/${config.workload}, repetition ${rep+1}/${repetitions}`);
      const start=Date.now();let networkPhase='slow';
      while(await page.evaluate(()=>window.bench.running)){
        const elapsed=Date.now()-start;
        if(config.workload==='network'){
          if(elapsed>=10000&&networkPhase==='slow'){await phase('offline',true,0,0);networkPhase='offline';}
          if(elapsed>=310000&&networkPhase==='offline'){await phase('reconnected',false,1250000,20);networkPhase='recovered';}
        }
        if(['journey','soak'].includes(config.workload))await trustedJourney(page);
        if(config.workload==='complex'){await page.locator('[data-deep]').click();await page.locator('[data-repeated]').fill(`Synthetic iteration ${Math.floor(elapsed/1000)}`);}
        if(config.workload==='lifecycle'&&elapsed>10000&&elapsed<12000){const other=await context.newPage();await other.goto('about:blank');await other.bringToFront();await page.waitForTimeout(1000);await page.bringToFront();await other.close();}
        await page.waitForTimeout(config.workload==='complex'?250:1000);
      }
      await page.waitForFunction(()=>Boolean(window.bench.result),null,{timeout:25000});
      const result=await page.evaluate(()=>window.bench.result);
      result.externalDriver={name:'Playwright Chromium',headless:process.env.HEADLESS==='1',networkControlled:config.workload==='network',networkSchedule:config.workload==='network'?{slowSeconds:10,offlineSeconds:300,recoverySeconds:50}:null};
      await writeFile(`${directory}/${String(rep+1).padStart(3,'0')}-${mode}-${config.workload}.json`,JSON.stringify(result,null,2));
      console.log(`Saved ${mode}: ${result.replay.successfulUploads??'unobserved'} successful replay upload responses; verify playback separately.`);
      await context.close();
    }
  }
}finally{await browser.close();}
