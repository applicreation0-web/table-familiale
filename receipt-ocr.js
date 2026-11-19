// Photo ou galerie sur Android Capacitor. OCR ML Kit fonctionne localement.
// Pas de transmission du ticket vers un serveur; ni photo ni texte brut conservés.
export function nativeReceiptAvailable(cap=globalThis.Capacitor){
 return !!cap?.isNativePlatform?.()&&!!cap.Plugins?.Camera&&!!cap.Plugins?.TextRecognition;
}
export async function captureReceiptText(cap=globalThis.Capacitor){
 if(!cap?.isNativePlatform?.())throw new Error('Sur le site web, coller le texte du ticket ; le scanner photo est disponible dans l’APK Android.');
 const camera=cap.Plugins?.Camera,ocr=cap.Plugins?.TextRecognition;
 if(!camera?.getPhoto||!ocr?.processImage)
   throw new Error('Modules natifs Camera et TextRecognition absents : installer l’APK mise à jour.');
 const photo=await camera.getPhoto({
   source:'PROMPT',resultType:'uri',quality:90,allowEditing:false,
   correctOrientation:true,promptLabelHeader:'Ticket de caisse',
   promptLabelPhoto:'Choisir une photo',promptLabelPicture:'Photographier'
 });
 const path=photo?.path;
 if(!path||typeof path!=='string')throw new Error('Aucune photo locale disponible pour la reconnaissance.');
 const result=await ocr.processImage({path,script:'LATIN'});
 const text=String(result?.text||'').trim();
 if(!text)throw new Error('Aucun texte lisible : éclairer le ticket et reprendre la photo.');
 return text;
}
