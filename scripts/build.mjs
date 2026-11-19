import { cp, mkdir, rm, copyFile } from 'node:fs/promises';
import {build} from 'esbuild';
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
for(const file of ['index.html','app.js','backup.js','pricing.js','receipt.js','receipt-benchmark.js','receipt-stock.js','receipt-quick.js','week1-plan.js','receipt-ocr.js','styles.css','model.js','family-portions.js','recipes.js','meal-plan.js','data.js','manifest.webmanifest','sw.js'])await copyFile(file,`dist/${file}`);
await cp('icons','dist/icons',{recursive:true});
await build({entryPoints:['receipt-native-entry.js'],bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,outfile:'dist/receipt-native-bundle.js'});
console.log('Application statique prête dans dist/');
