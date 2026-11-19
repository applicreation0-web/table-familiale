import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export function stampGradle(original,runNumber,version='1.0.8'){
 const run=Number(runNumber);
 if(!Number.isSafeInteger(run)||run<1||run>999)
   throw new Error('Numéro de compilation Android invalide.');
 if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error('Version Android invalide.');
 const [major,minor,patch]=version.split('.').map(Number);
 if(major!==1||!Number.isSafeInteger(minor)||minor>9||
    !Number.isSafeInteger(patch)||patch>99)
   throw new Error('Version Android hors plage contrôlée.');
 // 1.0.8 => 108001, 1.0.10 => 110001, 1.1.0 => 200001.
 const versionCode=100000+minor*100000+patch*1000+run;
 let count=0;
 let code=original.replace(/\bversionCode\s+\d+\b/g,()=>{
   count++;return 'versionCode '+versionCode;
 });
 if(count!==1)throw new Error('VersionCode Android absent ou ambigu.');
 count=0;
 code=code.replace(/\bversionName\s+["'][^"']+["']/g,()=>{
   count++;return 'versionName "'+version+'"';
 });
 if(count!==1)throw new Error('VersionName Android absent ou ambigu.');
 return {gradle:code,versionCode,version};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const file=process.argv[2]||'android/app/build.gradle';
 const {version}=JSON.parse(await readFile('package.json','utf8'));
 const result=stampGradle(await readFile(file,'utf8'),process.env.GITHUB_RUN_NUMBER,version);
 await writeFile(file,result.gradle);
 console.log('Android release: versionName='+result.version+', versionCode='+result.versionCode);
}
