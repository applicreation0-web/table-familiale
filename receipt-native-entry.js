// Chargé uniquement depuis l’APK Android : les plugins natifs sont enregistrés
// par le runtime Capacitor et le bundle est généré lors du build, hors CDN.
import {Camera,CameraResultType,CameraSource} from '@capacitor/camera';
import {TextRecognition,Script} from '@capacitor-mlkit/text-recognition';
import {reconstructReceiptRows} from './receipt-layout.js';
export async function recognizeReceiptPhoto(){
 const photo=await Camera.getPhoto({
  source:CameraSource.Prompt,resultType:CameraResultType.Uri,
  quality:90,allowEditing:false,correctOrientation:true,
  promptLabelHeader:'Ticket de caisse',
  promptLabelPhoto:'Choisir une photo',promptLabelPicture:'Photographier'
 });
 if(!photo?.path)throw new Error('Aucune image locale disponible');
 const result=await TextRecognition.processImage({path:photo.path,script:Script.Latin});
 return reconstructReceiptRows(result);
}
