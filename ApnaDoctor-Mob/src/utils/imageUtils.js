import * as FileSystem from 'expo-file-system';

/**
 * Converts a `data:image/png;base64,...` string (as returned by the
 * signature pad) into a local file URI, so a drawn signature can be
 * passed through the exact same upload pipeline as a gallery-picked
 * image (uploadMyPhoto / uploadMySignature both expect a `uri`).
 */
export async function dataUrlToFileUri(dataUrl, filename = `signature-${Date.now()}.png`) {
   const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
   const fileUri = `${FileSystem.cacheDirectory}${filename}`;
   await FileSystem.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
   });
   return fileUri;
}
