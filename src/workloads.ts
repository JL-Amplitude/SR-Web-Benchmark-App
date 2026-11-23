import { products, rng } from './core.js';
export function mountWorkload(root:HTMLElement,config:any,note:(kind:string,detail?:any)=>void) {
  const random=rng(config.seed), catalog=products(config.seed);
  let step=0, updates=0, actions=0, cycles=0, scroller:HTMLElement|null=null;
  let state='browse';
  const money=(value:number)=>`€${value}.00`;
  const set=(html:string)=>{root.innerHTML=html;};
  function browse(filter='') {
    state='browse';
    set(`<header class="store-header"><b>FORM / FIELD</b><span>Objects for everyday living</span><span>Collection 2026</span></header><section class="store-hero"><span class="eyebrow">THOUGHTFULLY MADE</span><h1>Good things.<br>Every day.</h1><p>A small collection. A repeatable journey.</p></section><label class="search-label">Search the collection<input data-search type="search" placeholder="Try notebook" aria-label="Search the collection" value="${filter}"></label><div class="catalog">${catalog.filter(p=>p.name.toLowerCase().includes(filter.toLowerCase())).map(p=>`<button class="product" data-product="${p.id}"><span class="product-art ${p.color}"><span class="product-shape">${p.id%3===0?'◒':p.id%3===1?'▱':'◉'}</span></span><span>${p.name}</span><strong>${money(p.price)}</strong></button>`).join('')}</div>`);
    root.querySelector<HTMLInputElement>('[data-search]')!.addEventListener('input',e=>{const input=e.target as HTMLInputElement;const start=input.selectionStart; browse(input.value);const next=root.querySelector<HTMLInputElement>('[data-search]')!;next.focus();if(next.type!=='search')next.setSelectionRange(start,start);});
    root.querySelectorAll<HTMLElement>('[data-product]').forEach(button=>button.addEventListener('click',()=>detail(Number(button.dataset.product))));
  }
  function detail(id=1) {
    state='detail';const p=catalog[id-1];
    set(`<button class="text-button" data-back>Back to collection</button><div class="detail"><div class="product-art ${p.color}"><span class="product-shape">▱</span></div><div><span class="eyebrow">THE EVERYDAY COLLECTION</span><h1>${p.name}</h1><h2>${money(p.price)}</h2><p>Designed to be used, carried, and enjoyed. Synthetic benchmark product ${p.id}; ${p.stock} items in stock.</p><button class="primary" data-checkout>Continue to checkout</button></div></div>`);
    root.querySelector('[data-back]')!.addEventListener('click',()=>browse());root.querySelector('[data-checkout]')!.addEventListener('click',()=>checkout(p));
  }
  function checkout(p:any) {
    state='form';set(`<section class="checkout"><span class="eyebrow">SYNTHETIC CHECKOUT</span><h1>Make it yours.</h1><p>${p.name} · ${money(p.price)}</p><form><label>Name<input name="name" required autocomplete="off" value="" placeholder="Alex Sample"></label><label>Email<input name="email" type="email" required autocomplete="off" placeholder="alex@example.test"></label><label>Delivery note<textarea name="note" placeholder="Synthetic test data only"></textarea></label><button class="primary" type="submit">Place test order</button></form></section>`);
    root.querySelector('form')!.addEventListener('submit',e=>{e.preventDefault();state='confirmation';cycles++;set(`<section class="confirmation"><div class="checkmark">✓</div><span class="eyebrow">TEST ORDER CONFIRMED</span><h1>All set, Alex.</h1><p>Order BENCH-${String(cycles).padStart(4,'0')}. No purchase or payment was made.</p><button class="primary" data-restart>Back to collection</button></section>`);root.querySelector('[data-restart]')!.addEventListener('click',()=>browse());});
  }
  if(['journey','soak'].includes(config.workload)) browse();
  if(config.workload==='large') {
    // Exactly N element descendants, excluding the invariant root itself.
    const fragment=document.createDocumentFragment();
    for(let i=0;i<config.nodes;i++){const el=document.createElement('div');el.className='dom-cell';el.textContent=`Node ${String(i+1).padStart(5,'0')} · ${Math.floor(random()*10000)}`;fragment.append(el);}
    root.classList.add('node-grid');root.append(fragment);note('node-count',{requested:config.nodes,actual:root.querySelectorAll('*').length});
  }
  if(['updates','network'].includes(config.workload)) {
    set(`<header class="market-heading"><div><span class="eyebrow">SEEDED MARKET FEED</span><h1>Live inventory</h1></div><p>Fixed target: ${config.updateHz} updates / second</p></header><div class="market-table" data-expensive>${Array.from({length:120},(_,i)=>`<div class="market-row"><span>ITEM-${String(i+1).padStart(3,'0')}</span><b>${catalog[i%24].name}</b><span data-price>€${(random()*100).toFixed(2)}</span><span data-quantity>${Math.floor(random()*100)}</span></div>`).join('')}</div>`);
  }
  if(config.workload==='scroll') {
    set(`<header class="market-heading"><div><span class="eyebrow">MOTION & SCROLL</span><h1>A longer collection.</h1></div><div class="orbit" aria-label="Continuous animation"></div></header><div class="scroll-box" data-scroll>${Array.from({length:200},(_,i)=>`<article class="scroll-card"><span class="card-number">${String(i+1).padStart(3,'0')}</span><div><h3>${catalog[i%24].name}</h3><p>Durable materials, a simple silhouette, and a little room for the everyday.</p><details><summary>Product details</summary><p>Seeded item ${i+1}. Material: recycled canvas. Dimensions: 24 × 18 cm.</p></details></div><span>${money(catalog[i%24].price)}</span></article>`).join('')}</div>`);scroller=root.querySelector('[data-scroll]');
  }
  if(config.workload==='complex') {
    set(`<header class="market-heading"><div><span class="eyebrow">DEEP INTERACTION</span><h1>Find the signal.</h1></div><p>${config.depth} levels · 20 siblings per level</p></header><div data-depth></div><label class="complex-input">Repeated synthetic input<input data-repeated aria-label="Repeated input" autocomplete="off"></label><p data-count>Activations: 0</p>`);
    let parent=root.querySelector('[data-depth]')!;
    for(let level=0;level<config.depth;level++){
      const branch=document.createElement('div');branch.className='branch';
      for(let sibling=0;sibling<20;sibling++){const leaf=document.createElement('span');leaf.className='branch-leaf';leaf.textContent='·';branch.append(leaf);}
      const child=document.createElement('div');child.className='branch-child';branch.append(child);parent.append(branch);parent=child;
    }
    const button=document.createElement('button');button.className='primary';button.dataset.deep='';button.textContent='Activate nested control';parent.append(button);
    button.addEventListener('click',()=>{actions++;root.querySelector('[data-count]')!.textContent=`Activations: ${actions}`;});
  }
  if(config.workload==='lifecycle') set(`<section class="lifecycle-card"><span class="eyebrow">REAL LIFECYCLE EVENTS</span><h1>A change of context.</h1><p>Navigation is automated. Switch tabs, minimize this window, or reload to produce real lifecycle events. The runner logs what actually occurs.</p><div class="route-card" data-route>Route: overview</div><button data-new-session class="primary">Start a new SDK session</button><button data-reload class="secondary">Reload & resume run</button><a class="text-button" href="about:blank" target="_blank" rel="noopener">Open a blank tab</a></section>`);
  root.querySelector('[data-new-session]')?.addEventListener('click',()=>note('request-new-session'));
  root.querySelector('[data-reload]')?.addEventListener('click',()=>note('request-reload'));
  return {
    tick(elapsedMs:number) {
      step++;
      if(['journey','soak'].includes(config.workload)) {
        if(config.driver==='external')return;
        if(state==='browse') {
          const search=root.querySelector<HTMLInputElement>('[data-search]')!;
          if(!search.value){search.value='notebook';search.dispatchEvent(new Event('input',{bubbles:true}));}
          else root.querySelector<HTMLButtonElement>('[data-product]')?.click();
        } else if(state==='detail') root.querySelector<HTMLButtonElement>('[data-checkout]')!.click();
        else if(state==='form') {const form=root.querySelector<HTMLFormElement>('form')!;for(const [key,value] of Object.entries({name:'Alex Sample',email:'alex@example.test',note:`Seed ${config.seed}; cycle ${cycles+1}`})){const input=form.elements.namedItem(key) as HTMLInputElement;input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));}form.requestSubmit();}
        else root.querySelector<HTMLButtonElement>('[data-restart]')!.click();
      }
      if(['updates','network'].includes(config.workload)) {
        // One scheduled tick = two text mutations. No catch-up burst after a blocked/background tab.
        const index=Math.floor(random()*120),row=root.querySelectorAll('.market-row')[index];
        row.querySelector('[data-price]')!.firstChild!.nodeValue=`€${(random()*100).toFixed(2)}`;
        row.querySelector('[data-quantity]')!.firstChild!.nodeValue=String(++updates);
      }
      if(config.workload==='large' && step%4===0){const cell=root.children[Math.floor(random()*config.nodes)];cell.textContent=`Updated node ${step}`;}
      if(config.workload==='scroll') {scroller!.scrollTop=((Math.sin(elapsedMs/2500-Math.PI/2)+1)/2)*(scroller!.scrollHeight-scroller!.clientHeight);if(step%4===0){const details=root.querySelectorAll('details');const index=Math.floor(random()*details.length);details[index].open=!details[index].open;}}
      if(config.workload==='complex' && config.driver!=='external') {
        root.querySelector<HTMLButtonElement>('[data-deep]')!.click();const input=root.querySelector<HTMLInputElement>('[data-repeated]')!;input.value=`Synthetic ${step} seed ${config.seed}`;input.dispatchEvent(new Event('input',{bubbles:true}));
      }
      if(config.workload==='lifecycle'){const route=['overview','details','settings'][step%3];location.hash=route;root.querySelector('[data-route]')!.textContent=`Route: ${route}`;}
    },
    intervalMs: ['updates','network'].includes(config.workload)?1000/config.updateHz:config.workload==='scroll'?50:config.workload==='complex'?250:1000,
    stats:()=>({ticks:step,updates,explicitTextWrites:updates*2,journeyCycles:cycles,activations:actions,state,elementNodes:root.querySelectorAll('*').length}),
    destroy(){root.classList.remove('node-grid');},
  };
}
