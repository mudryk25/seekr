import { showHUD, showToast, Toast, open, captureException, closeMainWindow } from "@raycast/api";
import { exec } from "child_process";
import { existsSync, unlinkSync } from "fs";
import { promisify } from "util";
import { uploadToGoogleLens } from "./google-lens";

const execAsync = promisify(exec);

/** Max dimension (width or height) before upload — keeps files small. */
const MAX_IMAGE_DIMENSION = 1000;

/**
 * Downscales an image using macOS `sips` so the longest edge is at most
 * MAX_IMAGE_DIMENSION pixels. This dramatically reduces file size
 * (and therefore upload time) without affecting search quality.
 */
async function optimizeImage(filePath: string): Promise<void> {
  // Get current dimensions
  const { stdout } = await execAsync(`/usr/bin/sips -g pixelWidth -g pixelHeight "${filePath}"`);

  const widthMatch = stdout.match(/pixelWidth:\s*(\d+)/);
  const heightMatch = stdout.match(/pixelHeight:\s*(\d+)/);

  if (!widthMatch || !heightMatch) return;

  const width = parseInt(widthMatch[1], 10);
  const height = parseInt(heightMatch[1], 10);
  const longest = Math.max(width, height);

  if (longest <= MAX_IMAGE_DIMENSION) return; // Already small enough

  // Resize so the longest edge = MAX_IMAGE_DIMENSION, preserving aspect ratio
  if (width >= height) {
    await execAsync(`/usr/bin/sips --resampleWidth ${MAX_IMAGE_DIMENSION} "${filePath}" --out "${filePath}"`);
  } else {
    await execAsync(`/usr/bin/sips --resampleHeight ${MAX_IMAGE_DIMENSION} "${filePath}" --out "${filePath}"`);
  }
}

/**
 * Seekr — Snip to Search
 *
 * 1. Opens macOS screencapture in interactive selection mode
 * 2. Optimizes the image (resize + JPEG compression) for fast upload
 * 3. Uploads the snip to Google Lens
 * 4. Opens the search results in the default browser
 * 5. Cleans up the temporary screenshot file
 */
export default async function Command() {
  const tmpPath = `/tmp/seekr-snip-${Date.now()}.jpg`;

  // ── Step 1: Dismiss Raycast and capture screen region ─────────
  await closeMainWindow();

  try {
    // -i = interactive (crosshair selection)
    // -x = silent (no shutter sound)
    // -t jpg = capture as JPEG (much smaller than PNG)
    await execAsync(`/usr/sbin/screencapture -i -x -t jpg "${tmpPath}"`);
  } catch {
    // screencapture exits with code 1 on cancel (Escape) — that's expected.
  }

  // If the file doesn't exist, either the user cancelled or capture failed
  if (!existsSync(tmpPath)) {
    return; // Exit silently
  }

  // ── Step 2: Optimize & upload ─────────────────────────────────
  try {
    // Resize to max 1000px — Google Lens doesn't need retina resolution.
    // A 6000×3000 PNG (~10 MB) becomes a 1000×500 JPEG (~50 KB).
    await optimizeImage(tmpPath);

    // Upload and open results — run in parallel where possible
    const resultsUrl = await uploadToGoogleLens(tmpPath);
    await open(resultsUrl);
    await showHUD("🔍 Searching with Google Lens…");
  } catch (error) {
    captureException(error);
    await showToast({
      style: Toast.Style.Failure,
      title: "Search failed",
      message: error instanceof Error ? error.message : "An unexpected error occurred.",
    });
  } finally {
    // ── Cleanup temp file ─────────────────────────────────────
    try {
      if (existsSync(tmpPath)) {
        unlinkSync(tmpPath);
      }
    } catch {
      // Non-critical
    }
  }
}
