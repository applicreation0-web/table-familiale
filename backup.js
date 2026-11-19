/**
 * Export natif Android : le téléchargement d'un blob depuis une WebView n'est
 * pas fiable. Le document JSON est d'abord écrit dans le cache de l'application
 * puis présenté au sélecteur de partage Android (Enregistrer dans Drive/Fichiers).
 * Le cache ne constitue pas une sauvegarde durable : le destinataire du partage
 * doit conserver le fichier.
 */
export async function shareNativeBackup(json,filename,capacitor=globalThis.Capacitor){
  if(!capacitor?.isNativePlatform?.())return false;
  const fs=capacitor.Plugins?.Filesystem;
  const share=capacitor.Plugins?.Share;
  if(!fs?.writeFile||!fs?.getUri||!share?.share){
    throw new Error('Sauvegarde Android indisponible : modules Filesystem et Share manquants.');
  }
  const options={path:filename,directory:'CACHE'};
  await fs.writeFile({...options,data:json,encoding:'utf8'});
  const file=await fs.getUri(options);
  if(!file?.uri)throw new Error('Aucune URI de sauvegarde obtenue.');
  await share.share({
    title:'Sauvegarde Table Familiale',
    dialogTitle:'Enregistrer la sauvegarde JSON',
    files:[file.uri]
  });
  return true;
}

export function downloadWebBackup(json,filename,dom=globalThis.document,urls=globalThis.URL){
  const blob=new Blob([json],{type:'application/json'});
  const url=urls.createObjectURL(blob);
  try{
    const a=dom.createElement('a');
    a.href=url;a.download=filename;
    dom.body.append(a);a.click();a.remove();
  }finally{
    urls.revokeObjectURL(url);
  }
}
