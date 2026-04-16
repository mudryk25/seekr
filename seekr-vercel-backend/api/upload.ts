import { put, del } from '@vercel/blob';
import multiparty from 'multiparty';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';

// Configure Vercel to not parse the body natively, so multiparty can read the raw binary buffers
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const form = new multiparty.Form();

    const { files } = await new Promise<{ fields: any; files: any }>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const fileArray = files.file || files.encoded_image;
    if (!fileArray || fileArray.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No file uploaded' });
    }

    const uploadedFile = fileArray[0];
    const fileBuffer = fs.readFileSync(uploadedFile.path);

    const uuid = crypto.randomUUID();
    const filename = `seekr-snips/${uuid}.jpg`;

    // Upload to Vercel Blob store
    const blob = await put(filename, fileBuffer, {
      access: 'public',
      contentType: 'image/jpeg'
    });

    // We return our custom API route which incorporates the Burn-On-Read deletion trigger
    // req.headers.host handles dynamic deployment domains automatically
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const proxyUrl = `${protocol}://${req.headers.host}/api/image?id=${uuid}`;

    return res.status(200).json({
      status: 'success',
      data: {
        url: proxyUrl
      }
    });

  } catch (error: any) {
    console.error("Vercel Proxy Error:", error);
    return res.status(500).json({ error: error.message || "Internal Upload Error" });
  }
}
