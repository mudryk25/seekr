import { createReadStream } from "fs";
import FormData from "form-data";
import fetch from "node-fetch";

/**
 * Uploads an image explicitly via a secure, privacy-first temporary host (tmpfiles.org).
 * We bypass the session-mismatch "Image not found" error by presenting Google Lens
 * with a public URI that your own browser resolves using its native session cookies.
 *
 * @param imagePath - Absolute path to the image file to upload
 * @returns The final Google Lens search URL to be opened in the user browser
 */
export async function uploadToGoogleLens(imagePath: string): Promise<string> {
  const form = new FormData();
  form.append("file", createReadStream(imagePath));

  const response = await fetch("https://tmpfiles.org/api/v1/upload", {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Temporary host rejected the upload. Status: ${response.status}`);
  }

  const data = (await response.json()) as { data?: { url?: string } };

  if (!data?.data?.url) {
    throw new Error(`Upload succeeded but the host failed to return a valid URL.`);
  }

  // tmpfiles returns exactly: "http://tmpfiles.org/12345/snip.jpg"
  // We need to inject "/dl/" into the path to trigger raw byte streaming for Google Lens
  const rawFileUrl = data.data.url.replace("tmpfiles.org/", "tmpfiles.org/dl/");

  // We wrap this inside the native Google Lens parameter
  return `https://lens.google.com/upload?url=${encodeURIComponent(rawFileUrl)}`;
}
