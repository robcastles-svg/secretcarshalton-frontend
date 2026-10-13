/**
 * Shrinks a photo in the browser before it's uploaded. Uploads pass
 * through a Vercel function on their way to WordPress, and Vercel turns
 * away any request over about 4.5 MB, so a straight-off-the-phone photo
 * (often 3-8 MB) failed with nothing reaching WordPress at all (Rob,
 * 2026-10, listing photos). Resizing to at most `maxSide` pixels also
 * saves space on the server. Anything that can't be decoded (or a GIF or
 * SVG) goes up unchanged; PNGs stay PNG, so logos keep transparency.
 */
export async function shrinkImage(file: File, maxSide = 2000): Promise<File> {
  if (!file.type.startsWith("image/") || /gif|svg/.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1.2 * 1024 * 1024) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const type = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.86));
    if (!blob || blob.size >= file.size) return file;
    const name = type === "image/jpeg" ? file.name.replace(/\.(png|heic|heif|webp|jpe?g)$/i, "") + ".jpg" : file.name;
    return new File([blob], name, { type });
  } catch {
    return file;
  }
}

/** shrinkImage on every picture in a form's data, in place of the original. */
export async function shrinkFormImages(formData: FormData, maxSide = 2000): Promise<FormData> {
  const out = new FormData();
  for (const [key, value] of formData.entries()) {
    if (value instanceof File && value.size > 0) out.append(key, await shrinkImage(value, maxSide));
    else out.append(key, value);
  }
  return out;
}
