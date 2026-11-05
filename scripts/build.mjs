import {build} from 'esbuild';
import {mkdir,copyFile,writeFile,readFile} from 'node:fs/promises';
await mkdir('www',{recursive:true});
// Açık izin listesi: repo, kişisel yedekler ve test verileri APK'ya kopyalanmaz.
await build({entryPoints:['src/app.js'],outfile:'www/app.js',bundle:true,format:'iife',minify:true,legalComments:'eof'});
for (const file of ['index.html','icon-512.png','manifest.json']) await copyFile(file,`www/${file}`);
await writeFile('www/sw.js',await readFile('sw.js'));
console.log('Çevrimdışı web paketi oluşturuldu.');
