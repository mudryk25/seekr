import { del, head } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { id } = req.query;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing image ID' });
  }

  try {
    const filename = `seekr-snips/${id}.jpg`;
    
    // We get the public URL from the Blob store mapping
    // But Vercel Blob URLs require fetching to pass the raw data
    const blobDetails = await head(filename).catch(() => null);

    if (!blobDetails) {
      return res.status(404).send("Image expired or not found");
    }

    const response = await fetch(blobDetails.url);
    if (!response.ok) {
       return res.status(404).send("Image body could not be fetched from edge store.");
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Burn On Read: Delete immediately so it naturally expires from internet fabric
    // Note: Edge/Serverless might block execution without waitUntil, but we await deletion here since 
    // it executes very fast, ensuring privacy immediately.
    await del(blobDetails.url);

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    
    // Pipe the image raw bytes back to Google Lens 
    return res.status(200).send(buffer);

  } catch (error: any) {
    console.error("Vercel Fetch Proxy Error:", error);
    return res.status(500).json({ error: error.message || "Failed to retrieve snippet" });
  }
}
