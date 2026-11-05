export class Drive {
 constructor(native,isNative,fetcher=fetch){this.native=native;this.isNative=isNative;this.fetcher=fetcher;this.token=null;this.expires=0;}
 filename(){const d=new Date(),p=n=>String(n).padStart(2,'0');return `kart_takip_${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}_${crypto.randomUUID().slice(0,8)}.json`;}
 async connect(silent=false){if(!this.isNative)throw Error('Google Drive bağlantısı Android APK içinde kullanılabilir.');const r=await this.native.authorize({silent});this.token=r.token;this.expires=Date.now()+50*60*1000;}
 async request(path,options={},silent=false){
  if(!this.token||Date.now()>this.expires)await this.connect(silent);
  const r=await this.fetcher('https://www.googleapis.com/'+path,{...options,headers:{...options.headers,Authorization:'Bearer '+this.token}});
  if(!r.ok){if(r.status===401){this.token=null;this.expires=0;}throw Error(`Drive isteği başarısız (${r.status}). Yerel verileriniz korunuyor.`);}
  return r.status===204?null:r;
 }
 async query(q,silent=false){let files=[],pageToken;do{const params=new URLSearchParams({q,fields:'nextPageToken,files(id,name,createdTime)',pageSize:'1000',orderBy:'createdTime desc'});if(pageToken)params.set('pageToken',pageToken);const d=await(await this.request('drive/v3/files?'+params,{},silent)).json();files.push(...d.files);pageToken=d.nextPageToken;}while(pageToken);return files;}
 async folder(silent=false){const files=await this.query("trashed = false and mimeType = 'application/vnd.google-apps.folder' and name = 'Kart Takip Yedekleri'",silent);if(files.length)return files[0].id;const r=await this.request('drive/v3/files',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Kart Takip Yedekleri',mimeType:'application/vnd.google-apps.folder'})},silent);return(await r.json()).id;}
 async backup(text,silent=false){const folder=await this.folder(silent),boundary='kart_'+crypto.randomUUID();await this.request('upload/drive/v3/files?uploadType=multipart',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body:`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({name:this.filename(),parents:[folder],mimeType:'application/json'})}\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${text}\r\n--${boundary}--`},silent);}
 async list(){const folders=await this.query("trashed = false and mimeType = 'application/vnd.google-apps.folder' and name = 'Kart Takip Yedekleri'");const all=[];for(const f of folders)all.push(...await this.query(`trashed = false and '${f.id}' in parents and mimeType = 'application/json'`));return all.sort((a,b)=>b.createdTime.localeCompare(a.createdTime));}
 async restore(id){const r=await this.request('drive/v3/files/'+encodeURIComponent(id)+'?alt=media');const text=await r.text();if(text.length>20*1024*1024)throw Error('Yedek çok büyük.');return text;}
 async remove(id){await this.request('drive/v3/files/'+encodeURIComponent(id),{method:'DELETE'});}
 async disconnect(){if(this.isNative)await this.native.disconnect();this.token=null;this.expires=0;}
}
