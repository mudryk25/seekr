import { createReadStream } from "fs";
import FormData from "form-data";
import fetch from "node-fetch";
import { basename } from "path";

const API_BASE_URL = "https://google-lens.yencheng.dev";
const UPLOAD_ENDPOINT = `${API_BASE_URL}/upload-image`;

interface UploadResponse {
  filename?: string;
  message?: string;
  error?: string;
}

/**
 * Uploads an image to a temporary hosting server and returns a Google Lens
 * search URL that can be opened in the browser.
 *
 * Flow:
 *   1. Upload image to intermediary server → get a public URL
 *   2. Construct lens.google.com/uploadbyurl?url={public_url}
 *
 * This approach is used because Google Lens's direct upload endpoint
 * has anti-bot protections. The uploadbyurl method lets Google fetch
 * the image itself from a public URL.
 *
 * @param imagePath - Absolute path to the image file to upload
 * @returns The Google Lens search URL to open in the browser
 */
export async function uploadToGoogleLens(imagePath: string): Promise<string> {
  const ext = imagePath.split(".").pop()?.toLowerCase() ?? "jpg";
  const contentType = ext === "png" ? "image/png" : "image/jpeg";

  const form = new FormData();
  form.append("image", createReadStream(imagePath), {
    filename: basename(imagePath),
    contentType,
  });

  const response = await fetch(UPLOAD_ENDPOINT, {
    method: "POST",
    body: form,
    headers: form.getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Image upload failed with status ${response.status}: ${response.statusText}`);
  }

  const result = (await response.json()) as UploadResponse;

  if (!result.filename) {
    throw new Error(result.error || "Upload succeeded but no filename was returned.");
  }

  const imageUrl = `${API_BASE_URL}/image/${result.filename}`;
  return `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imageUrl)}`;
}
