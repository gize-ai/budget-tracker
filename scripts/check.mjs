import {readdir,readFile,access} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {spawnSync} from 'node:child_process';
let count=0;
for(const directory of ['public','server','scripts','tests']){
 for(const file of await readdir(directory)){
  if(!['.js','.mjs'].includes(extname(file)))continue;
  const result=spawnSync(process.execPath,['--check',resolve(directory,file)],{encoding:'utf8'});
  if(result.status!==0){console.error(result.stderr);process.exit(1);}count++;
 }
}
const html=await readFile('public/index.html','utf8');
for(const [,path]of html.matchAll(/(?:src|href)="(\/(?!\/)[^"#]+)"/g))await access(resolve('public','.'+path));
for(const asset of ['hands.jpg','focus.jpg','marble.png','spartan.png'])await access(resolve('public/assets',asset));
console.log(`Checked ${count} JavaScript modules and local assets.`);
