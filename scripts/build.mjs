import { cp, mkdir, rm, copyFile } from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
for(const file of ['index.html','app.js','styles.css','model.js','recipes.js','data.js','manifest.webmanifest','sw.js'])await copyFile(file,`dist/${file}`);
await cp('icons','dist/icons',{recursive:true});
console.log('Application statique prête dans dist/');
