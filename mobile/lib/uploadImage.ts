import * as ImageManipulator from 'expo-image-manipulator'
import { supabase } from '@/lib/supabase'

/**
 * Compress a local image URI and upload it to Supabase Storage.
 * Uses ImageManipulator's base64 output to avoid fetch(file://) issues on Android.
 */
export async function uploadImageToStorage(
  uri: string,
  bucket: string,
  filePath: string,
  resizeWidth = 1000,
): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: resizeWidth } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  )

  if (!result.base64) throw new Error('Image compression failed')

  // Convert base64 → Uint8Array (atob is available in React Native / Hermes)
  const binary = atob(result.base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, bytes, { contentType: 'image/jpeg', upsert: true })

  if (error) throw error

  return supabase.storage.from(bucket).getPublicUrl(filePath).data.publicUrl
}
