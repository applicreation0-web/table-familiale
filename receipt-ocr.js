// Appareil Android uniquement. La prise de photo et la reconnaissance
// ML Kit sont chargées depuis un bundle local généré pendant le build.
export function nativeReceiptAvailable(cap=globalThis.Capacitor){
 return !!cap?.isNativePlatform?.();
}
export async function captureReceiptText(cap=globalThis.Capacitor,loader=()=>import('./receipt-native-bundle.js')){
 if(!cap?.isNativePlatform?.())
   throw new Error('Sur le site web, coller le texte du ticket ; le scanner photo est disponible dans l’APK Android.');
 let module;
 try{module=await loader();}
 catch{throw new Error('Modules Camera/ML Kit indisponibles : installer une APK avec la fonction de lecture de tickets.');}
 if(typeof module?.recognizeReceiptPhoto!=='function')throw new Error('Scanner natif absent de l’APK.');
 const text=String(await module.recognizeReceiptPhoto()||'').trim();
 if(!text)throw new Error('Aucun texte lisible : éclairer le ticket et reprendre la photo.');
 return text;
}
