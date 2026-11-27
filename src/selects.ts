import './selects.css';

// Native selects remain the source of truth for forms and automation. The visible
// combobox and listbox provide a consistent appearance across operating systems.
export function installSelects(root:HTMLElement){
  const controls=new Map<HTMLSelectElement,{button:HTMLButtonElement;sync:()=>void}>();
  let open:HTMLSelectElement|null=null,menu:HTMLDivElement|null=null,active=-1,sequence=0,buffer='',lastTyped=0;
  const chevron='<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const check='<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3 8 3 3 7-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const enabled=(select:HTMLSelectElement)=>Array.from(select.options).map((option,index)=>({option,index})).filter(({option})=>!option.disabled&&!(option.parentElement instanceof HTMLOptGroupElement&&option.parentElement.disabled)&&!option.hidden);
  function close(){if(open){const button=controls.get(open)?.button;button?.setAttribute('aria-expanded','false');button?.removeAttribute('aria-activedescendant');}menu?.remove();menu=null;open=null;active=-1;buffer='';}
  function highlight(index:number){
    if(!open||!menu)return;active=index;
    for(const option of menu.querySelectorAll<HTMLElement>('[role=option]'))option.classList.toggle('is-active',Number(option.dataset.index)===index);
    const option=menu.querySelector<HTMLElement>(`[data-index="${index}"]`);
    if(option){controls.get(open)?.button.setAttribute('aria-activedescendant',option.id);option.scrollIntoView({block:'nearest'});}
  }
  function choose(index:number){
    if(!open)return;const select=open,button=controls.get(select)?.button;
    const valid=enabled(select).some(item=>item.index===index);if(!valid)return;
    const changed=select.selectedIndex!==index;select.selectedIndex=index;close();controls.get(select)?.sync();
    if(changed){select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));}
    if(button?.isConnected)button.focus({preventScroll:true});
  }
  function show(select:HTMLSelectElement,index=select.selectedIndex){
    close();const control=controls.get(select);if(!control||select.disabled)return;control.sync();
    const items=enabled(select);if(!items.length)return;
    open=select;menu=document.createElement('div');menu.className='bench-select-menu';menu.id=`${control.button.id}-options`;menu.setAttribute('role','listbox');menu.setAttribute('aria-label',`${control.button.getAttribute('aria-label')} options`);
    Array.from(select.options).forEach((option,i)=>{
      if(option.hidden)return;
      const row=document.createElement('div');row.className='bench-select-option';row.id=`${menu!.id}-${i}`;row.dataset.index=String(i);row.setAttribute('role','option');row.setAttribute('aria-selected',String(select.selectedIndex===i));
      const disabled=!items.some(item=>item.index===i);if(disabled)row.setAttribute('aria-disabled','true');
      const text=document.createElement('span');text.textContent=option.label;row.append(text);const icon=document.createElement('span');icon.className='bench-select-check';icon.innerHTML=check;row.append(icon);
      row.addEventListener('pointermove',()=>{if(!disabled)highlight(i);});row.addEventListener('pointerdown',event=>event.preventDefault());row.addEventListener('click',()=>{if(!disabled)choose(i);});menu!.append(row);
    });
    document.body.append(menu);control.button.setAttribute('aria-expanded','true');control.button.setAttribute('aria-controls',menu.id);
    const rect=control.button.getBoundingClientRect(),gap=7,availableBelow=innerHeight-rect.bottom-gap-12,availableAbove=rect.top-gap-12;
    const below=availableBelow>=Math.min(menu.scrollHeight,240)||availableBelow>=availableAbove;
    menu.style.width=`${Math.min(Math.max(rect.width,220),innerWidth-24)}px`;
    menu.style.left=`${Math.max(12,Math.min(rect.left,innerWidth-menu.offsetWidth-12))}px`;
    menu.style.maxHeight=`${Math.max(48,Math.min(320,below?availableBelow:availableAbove))}px`;
    if(below)menu.style.top=`${rect.bottom+gap}px`;else menu.style.bottom=`${innerHeight-rect.top+gap}px`;
    highlight(items.some(item=>item.index===index)?index:items[0].index);
  }
  function enhance(select:HTMLSelectElement){
    if(select.multiple||select.size>1||controls.has(select))return;
    const label=select.getAttribute('aria-label')||Array.from(select.labels??[]).map(label=>Array.from(label.childNodes).filter(node=>node.nodeType===Node.TEXT_NODE).map(node=>node.textContent).join('').trim()).join(' ')||select.name||'Select an option';
    const wrapper=document.createElement('span');wrapper.className='bench-select';
    const button=document.createElement('button');button.type='button';button.className='bench-select-trigger';button.id=`bench-select-${++sequence}`;button.setAttribute('role','combobox');button.setAttribute('aria-label',label);button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls',`${button.id}-options`);
    const text=document.createElement('span');text.className='bench-select-value';button.append(text);const arrow=document.createElement('span');arrow.className='bench-select-chevron';arrow.innerHTML=chevron;button.append(arrow);
    select.before(wrapper);wrapper.append(select,button);select.classList.add('bench-select-native');select.setAttribute('aria-hidden','true');select.tabIndex=-1;
    function sync(){const value=select.selectedOptions[0]?.label??'No results available';if(text.textContent!==value)text.textContent=value;button.title=value;button.disabled=select.disabled;button.setAttribute('aria-required',String(select.required));if(select.disabled&&open===select)close();}
    controls.set(select,{button,sync});sync();select.addEventListener('change',sync);
    select.addEventListener('click',event=>{event.preventDefault();button.focus();show(select);});
    button.addEventListener('click',()=>{if(open===select)close();else show(select);});
    button.addEventListener('keydown',event=>{
      const items=enabled(select);if(!items.length)return;
      const current=items.findIndex(item=>item.index===(open===select?active:select.selectedIndex));
      if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
        event.preventDefault();let next=current;
        if(event.key==='Home')next=0;else if(event.key==='End')next=items.length-1;else next=Math.max(0,Math.min(items.length-1,current+(event.key==='ArrowDown'?1:-1)));
        if(open!==select)show(select,items[Math.max(0,next)].index);else highlight(items[Math.max(0,next)].index);
      }else if(event.key==='Enter'||event.key===' '){event.preventDefault();if(open===select)choose(active);else show(select);}
      else if(event.key==='Escape'){event.preventDefault();close();}
      else if(event.key==='Tab')close();
      else if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
        event.preventDefault();const now=Date.now();buffer=now-lastTyped<750?buffer+event.key.toLocaleLowerCase():event.key.toLocaleLowerCase();lastTyped=now;
        const matches=(prefix:string)=>[...items.slice(current+1),...items.slice(0,current+1)].find(item=>item.option.label.toLocaleLowerCase().startsWith(prefix));
        const match=matches(buffer)??matches(event.key.toLocaleLowerCase());
        if(match){if(open!==select){const typed=buffer;show(select,match.index);buffer=typed;}else highlight(match.index);}
      }
    });
  }
  function refresh(){
    for(const [select,control]of controls){if(!root.contains(select)){if(open===select)close();controls.delete(select);}else control.sync();}
    root.querySelectorAll<HTMLSelectElement>('select').forEach(enhance);
    if(open){const button=controls.get(open)?.button;if(!button?.getClientRects().length)close();else if(menu){const selected=Array.from(menu.querySelectorAll('[role=option]')).find(node=>node.getAttribute('aria-selected')==='true');if(Number((selected as HTMLElement|undefined)?.dataset.index)!==open.selectedIndex)close();}}
  }
  refresh();
  const observer=new MutationObserver(records=>{if(open&&records.some(record=>record.type==='childList'&&(record.target===open||(record.target instanceof Element&&record.target.closest('select')===open))))close();if(records.some(record=>record.type==='childList'||record.target instanceof HTMLSelectElement))refresh();});
  observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});
  document.addEventListener('pointerdown',event=>{if(open&&!controls.get(open)?.button.contains(event.target as Node)&&!menu?.contains(event.target as Node))close();});
  document.addEventListener('focusin',event=>{if(open&&!controls.get(open)?.button.contains(event.target as Node)&&!menu?.contains(event.target as Node))close();});
  document.addEventListener('scroll',event=>{if(open&&event.target!==menu&&!menu?.contains(event.target as Node))close();},true);
  window.addEventListener('resize',close);root.addEventListener('reset',()=>setTimeout(refresh,0));
  return refresh;
}
