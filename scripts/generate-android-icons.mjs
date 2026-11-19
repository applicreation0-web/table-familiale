import sharp from 'sharp';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

const res='android/app/src/main/res';
const source=await readFile('icons/icon.svg','utf8');
if(!source.includes('#304e3d')||!source.includes('viewBox="0 0 512 512"'))
  throw new Error('Icône source de Table Familiale non reconnue.');

const start=source.indexOf('>')+1;
const inner=source.slice(start,source.lastIndexOf('</svg>'));
const foregroundInner=inner.replace(/<rect\b[^>]*\/>/,'');
const foreground='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'+
  '<g transform="translate(64 64) scale(0.75)">'+foregroundInner+'</g></svg>';
const density={mdpi:48,hdpi:72,xhdpi:96,xxhdpi:144,xxxhdpi:192};

for(const [d,size] of Object.entries(density)){
 const dir=join(res,'mipmap-'+d);
 await mkdir(dir,{recursive:true});
 const full=await sharp(Buffer.from(source)).resize(size,size).png().toBuffer();
 await writeFile(join(dir,'ic_launcher.png'),full);
 await writeFile(join(dir,'ic_launcher_round.png'),full);
 // Adaptive icon foreground is a transparent mark; the background comes from
 // a separate solid color drawable. The logo stays inside the adaptive safe zone.
 const fg=await sharp(Buffer.from(foreground)).resize(Math.round(size*108/48))
   .png().toBuffer();
 await writeFile(join(dir,'ic_launcher_foreground.png'),fg);
}

const backgroundDir=join(res,'drawable');
await mkdir(backgroundDir,{recursive:true});
await writeFile(join(backgroundDir,'table_familiale_icon_bg.xml'),
 '<?xml version="1.0" encoding="utf-8"?>\n'+
 '<shape xmlns:android="http://schemas.android.com/apk/res/android">\n'+
 '  <solid android:color="#304e3d"/>\n</shape>\n');

const adaptive='<?xml version="1.0" encoding="utf-8"?>\n'+
 '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'+
 '  <background android:drawable="@drawable/table_familiale_icon_bg"/>\n'+
 '  <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>\n';
const adaptiveDir=join(res,'mipmap-anydpi-v26');
await mkdir(adaptiveDir,{recursive:true});
for(const name of ['ic_launcher.xml','ic_launcher_round.xml'])
 await writeFile(join(adaptiveDir,name),adaptive);
console.log('Icônes Android Table Familiale générées : 5 densités + adaptatives.');
