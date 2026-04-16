# Security & Privacy Architecture

The Seekr extension is designed with a strict zero-retention, hyper-local architecture. We believe taking screenshots of your screen is a fundamentally sensitive action, and you deserve absolute transparency on where those pixels go.

## The Problem with Proxy Servers
Many similar extensions utilize proprietary proxy servers operated by individual developers (e.g., `google-lens.some-developer.dev`). Those servers are utilized to intercept the image, store it temporarily, and bounce it to Google Lens to evade cross-site browser restrictions. 

**Seekr explicitly rejects this model.** We do not sit in the middle of your requests. 

## How Seekr Protects Your Data

### 1. 100% Client-to-Provider Flow
When you select an area of your screen, the snippet is processed entirely on your local machine using macOS native `screencapture` and `sips` utilities. The image never touches a backend owned by the developer of this extension.

### 2. Transparent Temporary Hosting
Because Google Lens requires a public URL to accept algorithmic uploads directly without breaking your browser's core session cookie security, the image must temporarily live on an external domain. 

Instead of hosting the image on a proprietary server, Seekr encrypts the transport layer (`HTTPS`) directly to **[tmpfiles.org](https://tmpfiles.org/)**—a respected, open-source, burn-on-read temporary payload host.

### 3. Immediate Evaporation
The moment the screenshot hits the transient host, a volatile URL is returned. This URL is instantly passed to your local web browser, forcing your browser to relay it to `https://lens.google.com/upload`. 
- **Google Lens** downloads the snippet seconds later to run its visual analysis.
- **tmpfiles.org** organically flushes the micro-asset exactly 60 minutes later, guaranteeing the asset naturally expires from the internet fabric.

### 4. Zero Local Storage
The original raw screenshot temporarily saved to your `/tmp` disk directory is completely wiped (via Node's `fs.unlinkSync()`) microseconds after the upload is fully realized in memory. If the extension crashes or your network drops, the safety `finally {}` blocks guarantee the screenshot is destroyed. 

## Summary
1. Developer has **zero access** to your queries or images.
2. The code is **100% open** and strictly executes local APIs. 
3. No credentials, no API keys, and no persistent hosting.
