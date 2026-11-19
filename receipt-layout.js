// Recomposition géométrique des lignes d'un ticket multi-colonnes (ML Kit).
// Une reconnaissance par colonnes séparées ne doit pas détacher les prix des articles.
export function reconstructReceiptRows(result){
 const raw=String(result?.text||'').trim();
 const detected=(result?.blocks||[]).flatMap(b=>b.lines||[]).map(line=>{
   const box=line.boundingBox||{};
   // Rect natif Capacitor ML Kit 8.2 : left/top/right/bottom (pas x/y).
   const x=Number(box.left??box.x),y=Number(box.top??box.y),
     height=Number(box.bottom!=null&&box.top!=null?box.bottom-box.top:box.height);
   return {text:String(line.text||'').trim(),x,y,height,cy:y+height/2};
 }).filter(x=>x.text&&[x.x,x.y,x.height].every(Number.isFinite)&&x.height>0);
 if(detected.length<4)return raw;
 const heights=detected.map(x=>x.height).sort((a,b)=>a-b);
 const typical=heights[Math.floor(heights.length/2)];
 const maxGap=Math.max(4,Math.min(16,typical*.55));
 detected.sort((a,b)=>a.cy-b.cy||a.x-b.x);
 const rows=[];
 for(const line of detected){
   const row=rows.at(-1);
   if(row&&Math.abs(line.cy-row.cy)<=maxGap){
     row.parts.push(line);
     row.cy=row.parts.reduce((s,x)=>s+x.cy,0)/row.parts.length;
   }else rows.push({cy:line.cy,parts:[line]});
 }
 const joined=rows.map(r=>r.parts.sort((a,b)=>a.x-b.x)
   .filter((x,i,arr)=>i===0||x.text!==arr[i-1].text||Math.abs(x.x-arr[i-1].x)>4)
   .map(x=>x.text).join(' ')).join('\n');
 // Ne jamais remplacer un OCR textuel exploitable par une reconstruction vide.
 const pricedRows=source=>String(source||'').split(/\r?\n/)
   .filter(line=>/[A-Za-zÀ-ÿ]{2}/.test(line)&&/\d{1,5}[.,]\d{2}/.test(line)).length;
 return pricedRows(joined)>=pricedRows(raw)?joined.trim()||raw:raw;
}
