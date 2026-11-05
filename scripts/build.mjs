import {build} from 'esbuild';
import {mkdir,copyFile,writeFile,readFile,readdir} from 'node:fs/promises';
await mkdir('www',{recursive:true});
// Açık izin listesi: repo, kişisel yedekler ve test verileri APK'ya kopyalanmaz.
const allowed=new Set(['app.js','index.html','icon-512.png','manifest.json','sw.js']);
for(const entry of await readdir('www',{withFileTypes:true})) {
  if(!entry.isFile() || !allowed.has(entry.name)) throw Error('Web çıktı dizininde beklenmeyen dosya var; APK paketleme durduruldu: '+entry.name);
}
await build({entryPoints:['src/app.js'],outfile:'www/app.js',bundle:true,format:'iife',minify:true,legalComments:'eof'});
for (const file of ['index.html','icon-512.png','manifest.json']) await copyFile(file,`www/${file}`);
await writeFile('www/sw.js',await readFile('sw.js'));
console.log('Çevrimdışı web paketi oluşturuldu.');
