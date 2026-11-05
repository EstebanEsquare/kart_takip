import {Capacitor,registerPlugin} from '@capacitor/core';
import {App} from '@capacitor/app';
import Chart from 'chart.js/auto';
import {Store,validate,merge,upsert,months,totals,empty} from './data.js';
import {Drive} from './drive.js';
const Native=registerPlugin('KartNative');
const native=Capacitor.isNativePlatform();
const adapter=native?{get:async key=>(await Native.readState()).value??null,set:async(key,value)=>Native.writeState({value})}:{get:async key=>localStorage.getItem(key),set:async(key,value)=>localStorage.setItem(key,value)};
const store=new Store(adapter);
let db=empty(),chart,busy=false,ready=false,timer,driveBusy=false;
const $=id=>document.getElementById(id);
const status=message=>{$('status').textContent=message;};
const drive=new Drive(Native,native);
const error=e=>status('İşlem tamamlanamadı: '+(e.message||e));
function years(){const current=$('yearSelect').value; $('knownYears').replaceChildren(...[...new Set([String(new Date().getFullYear()),current,...db.statements.map(s=>s.year)])].sort((a,b)=>Number(a)-Number(b)).map(y=>new Option(y,y)));}
function updateCardOptions(){const old=$('cardSelect').value;$('cardSelect').replaceChildren(...db.cards.map(c=>new Option(c,c)));if(db.cards.includes(old))$('cardSelect').value=old;years();}
function refreshUI(){
 const year=$('yearSelect').value,month=$('monthSelect').value;
 if(!/^[1-9]\d{0,3}$/.test(year)){status('1–9999 arasında bir yıl girin.');return;}
 years();const rows=db.statements.filter(s=>s.year===year&&s.month===month).sort((a,b)=>a.day-b.day);
 $('entryList').replaceChildren();
 for(const s of rows){
  const row=document.createElement('div');row.className='list-item'+(s.isPaid?' paid':'');
  const text=document.createElement('div'),name=document.createElement('strong'),detail=document.createElement('small');
  name.textContent=s.card;detail.textContent=`${s.amount.toLocaleString('tr-TR')} TL | Gün: ${s.day} | ${s.isPaid?'Ödendi':'Ödenmedi'}`;
  text.append(name,document.createElement('br'),detail);
  const edit=document.createElement('button');edit.textContent='Düzenle';edit.style.width='auto';edit.onclick=()=>{$('cardSelect').value=s.card;$('amountInput').value=s.amount;$('dayInput').value=s.day;$('amountInput').focus();};
  const paid=document.createElement('button');paid.textContent=s.isPaid?'Ödenmedi yap':'Ödendi yap';paid.style.width='auto';paid.onclick=()=>mutate(async()=>{const next=structuredClone(db);next.statements.find(v=>v.card===s.card&&v.year===s.year&&v.month===s.month).isPaid=!s.isPaid;await commit(next);});
  row.append(text,edit,paid);$('entryList').append(row);
 }
 $('totalDisplay').textContent='TOPLAM: '+rows.reduce((n,s)=>n+s.amount,0).toLocaleString('tr-TR',{minimumFractionDigits:2})+' TL';
 if(chart)chart.destroy();chart=new Chart($('yearlyBarChart'),{type:'bar',data:{labels:months.map(m=>m.slice(0,3)),datasets:[{label:year+' Aylık Toplam (TL)',data:totals(db,year),backgroundColor:'#BB86FC',borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{beginAtZero:true,ticks:{color:'#aaa'}},x:{ticks:{color:'#fff'}}},plugins:{legend:{display:false}}}});
}
async function mutate(fn){if(!ready||busy)return;busy=true;try{await fn();}catch(e){error(e);}finally{busy=false;}}
async function commit(next,options){db=await store.commit(next,options);updateCardOptions();refreshUI();schedule();}
async function addCardPrompt(){await mutate(async()=>{const name=prompt('Kart adı:');if(name===null)return;if(!name.trim()||db.cards.includes(name))throw Error('Boş veya mevcut kart adı.');const next=structuredClone(db);next.cards.push(name);await commit(next);$('cardSelect').value=name;});}
async function saveEntry(){await mutate(async()=>{
 const card=$('cardSelect').value,amount=Number($('amountInput').value),day=Number($('dayInput').value||1),year=$('yearSelect').value,month=$('monthSelect').value;
 if(!$('amountInput').value)throw Error('Tutar girin.');
 await commit(upsert(db,{card,amount,day,year,month,isPaid:false}));$('amountInput').value='';$('dayInput').value='';status('Ekstre kaydedildi.');
});}
async function conflict(a,b){
 const dialog=$('conflictDialog');$('conflictText').textContent=`${a.card} — ${a.year} ${a.month}\nMevcut: ${a.amount} TL, gün ${a.day}, ${a.isPaid?'ödendi':'ödenmedi'}\nGelen: ${b.amount} TL, gün ${b.day}, ${b.isPaid?'ödendi':'ödenmedi'}`;
 return new Promise(resolve=>{let done=false;const finish=v=>{if(done)return;done=true;dialog.close();resolve(v);};$('keepExisting').onclick=()=>finish('existing');$('keepIncoming').onclick=()=>finish('incoming');$('cancelImport').onclick=()=>finish('cancel');dialog.oncancel=e=>{e.preventDefault();finish('cancel');};dialog.showModal();});
}
async function processImport(raw){await mutate(async()=>{
 const incoming=validate(raw),replace=$('importMode').value==='replace';
 if(replace&&!confirm('Mevcut veriler seçilen yedekle değiştirilecek. Devam edilsin mi?'))return;
 const next=replace?incoming:await merge(db,incoming,conflict);
 await commit(next,{safety:true});status(`Aktarım tamamlandı: yedekte ${incoming.cards.length} kart, ${incoming.statements.length} ekstre; sonuçta ${db.cards.length} kart, ${db.statements.length} ekstre.`);
});}
async function chooseBackup(){if(!ready||busy)return;if(native){try{const r=await Native.readBackup();await processImport(r.text);}catch(e){error(e);}}else $('importFile').click();}
async function importBackup(e){const f=e.target.files[0];try{if(f){if(f.size>20*1024*1024)throw Error('Dosya 20 MB sınırını aşıyor.');await processImport(await f.text());}}catch(err){error(err);}finally{e.target.value='';}}
async function exportBackup(){if(!ready)return;try{const text=JSON.stringify(db),name=drive.filename().replace('.json','.txt');if(native)await Native.writeBackup({text,name});else{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}status('Yedek dışa aktarıldı.');}catch(e){error(e);}}
async function restoreSafety(){await mutate(async()=>{if(!store.state.safety)throw Error('Güvenlik yedeği yok.');if(confirm('Aktarım öncesi veriler geri yüklensin mi?'))await commit(store.state.safety,{safety:true});});}
async function clearAllData(){await mutate(async()=>{if(confirm('TÜM kart ve ekstre verileri silinsin mi? Drive yedekleri silinmez.')){db=await store.commit(empty());await store.metadata({safety:null,auto:false,pending:false});$('autoBackup').checked=false;updateCardOptions();refreshUI();status('Yerel veriler silindi.');}});}
function backupStatus(){$('autoBackup').checked=store.state.auto;$('lastBackup').textContent=store.state.lastBackup?'Son başarılı yedek: '+new Date(store.state.lastBackup).toLocaleString('tr-TR'):'Henüz Drive yedeği yok.';}
async function driveConnect(){try{await drive.connect();status('Google Drive yetkisi verildi.');schedule();}catch(e){error(e);}}
async function driveBackup(automatic=false){
 if(!ready||driveBusy||busy)return;
 driveBusy=true;const revision=store.state.revision;try{
  await drive.backup(JSON.stringify(db),automatic);
  await store.metadata(state=>({lastBackup:new Date().toISOString(),pending:state.revision!==revision}));backupStatus();status('Google Drive yedeği oluşturuldu.');
 }catch(e){error(e);}finally{driveBusy=false;if(store.state.revision!==revision)schedule();}
}
async function driveList(){try{
 const files=await drive.list();$('driveFiles').replaceChildren();
 for(const f of files){const row=document.createElement('div'),label=document.createElement('p'),restore=document.createElement('button'),del=document.createElement('button');label.textContent=f.name+' — '+new Date(f.createdTime).toLocaleString('tr-TR');restore.textContent='Bu yedeği yükle';restore.onclick=async()=>{try{await processImport(await drive.restore(f.id));}catch(e){error(e);}};del.textContent='Drive yedeğini sil';del.onclick=async()=>{if(confirm(f.name+' silinsin mi?'))try{await drive.remove(f.id);await driveList();}catch(e){error(e);}};row.append(label,restore,del);$('driveFiles').append(row);}if(!files.length)status('Drive yedeği bulunamadı.');
 }catch(e){error(e);}}
async function driveDisconnect(){try{await drive.disconnect();await store.metadata({auto:false});clearTimeout(timer);backupStatus();$('driveFiles').replaceChildren();status('Google Drive bağlantısı kaldırıldı.');}catch(e){error(e);}}
async function setAutoBackup(){try{await store.metadata({auto:$('autoBackup').checked});schedule();}catch(e){error(e);backupStatus();}}
function schedule(){clearTimeout(timer);if(store.state.auto&&store.state.pending)timer=setTimeout(()=>{if(navigator.onLine)driveBackup(true);},30000);}
Object.assign(window,{refreshUI,addCardPrompt,saveEntry,chooseBackup,importBackup,exportBackup,importFromTextArea:()=>processImport($('importArea').value),clearAllData,restoreSafety,driveConnect,driveBackup:()=>driveBackup(false),driveList,driveDisconnect,setAutoBackup});
async function init(){try{
 db=await store.load();
 // Eski tarayıcı kayıtlarını yalnızca yeni depo yoksa bir kez taşı.
 if(!await adapter.get('kart_takip_state_v1')){const raw=localStorage.getItem('cc_tracker_v8')??localStorage.getItem('cc_tracker_v7');if(raw)db=await store.commit(validate(raw));}
 $('yearSelect').value=new Date().getFullYear();months.forEach((m,i)=>{const o=new Option(m,m);o.selected=i===new Date().getMonth();$('monthSelect').append(o);});
 updateCardOptions();refreshUI();backupStatus();ready=true;status('Veriler cihazda saklanır.');schedule();
 if(native){await App.addListener('backButton',async()=>{if($('conflictDialog').open){$('cancelImport').click();return;}if(document.activeElement?.matches('input,textarea')){document.activeElement.blur();return;}if(confirm('Kart Takip kapatılsın mı?'))App.exitApp();});await App.addListener('appStateChange',({isActive})=>{if(isActive)schedule();});}
 else if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(error);
 window.addEventListener('online',schedule);
 }catch(e){status('Depo açılamadı. Mevcut kayıtlar korunuyor; uygulamayı kapatıp yeniden deneyin. '+e.message);document.querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=true);}}
init();
