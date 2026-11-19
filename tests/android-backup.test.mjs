import test from 'node:test';
import assert from 'node:assert/strict';
import {shareNativeBackup,downloadWebBackup} from '../backup.js';

test('Sauvegarde Android utilise uniquement CACHE et le partage d’un fichier JSON',async()=>{
 const calls=[];
 const capacitor={
  isNativePlatform:()=>true,
  Plugins:{
   Filesystem:{
    async writeFile(input){calls.push(['write',input]);return {uri:'file:///private/cache/backup.json'}},
    async getUri(input){calls.push(['uri',input]);return {uri:'file:///private/cache/backup.json'}}
   },
   Share:{async share(input){calls.push(['share',input]);return {}}}
  }
 };
 const json=JSON.stringify({version:8,months:{'0':{notes:'Sélam 🇬🇧'}}});
 const saved=await shareNativeBackup(json,'sauvegarde.json',capacitor);
 assert.equal(saved,true);
 assert.equal(calls.length,3);
 assert.deepEqual(calls[0],[ 'write',{path:'sauvegarde.json',directory:'CACHE',data:json,encoding:'utf8'}]);
 assert.deepEqual(calls[1],[ 'uri',{path:'sauvegarde.json',directory:'CACHE'}]);
 assert.deepEqual(calls[2][1].files,['file:///private/cache/backup.json']);
});

test('Web sans Capacitor conserve le téléchargement historique et sans Android faux positif',async()=>{
 assert.equal(await shareNativeBackup('{}','test.json',null),false);
 assert.equal(await shareNativeBackup('{}','test.json',{isNativePlatform:()=>false}),false);
 const events=[];
 const element={href:'',download:'',click(){events.push(['click',this.download])},remove(){events.push('remove')}};
 const dom={createElement:()=>element,body:{append(){events.push('append')}}};
 const urls={createObjectURL:()=>{events.push('create');return 'blob:test'},revokeObjectURL:url=>events.push(['revoke',url])};
 downloadWebBackup('{}','test.json',dom,urls);
 assert.deepEqual(events,['create','append',['click','test.json'],'remove',['revoke','blob:test']]);
});

test('En cas de plugin manquant ou URI inexistante, ne pas déclarer la sauvegarde réussie',async()=>{
 await assert.rejects(()=>shareNativeBackup('{}','a.json',{isNativePlatform:()=>true,Plugins:{}}),/indisponible/);
 const capacitor={isNativePlatform:()=>true,Plugins:{
  Filesystem:{writeFile:async()=>({}),getUri:async()=>({uri:''})},
  Share:{share:async()=>{throw new Error('Ne devrait jamais être appelée')}}
 }};
 await assert.rejects(()=>shareNativeBackup('{}','a.json',capacitor),/URI/);
});
