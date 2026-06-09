import { serveFile } from "jsr:@std/http/file-server";

const kv = await Deno.openKv();
// Set chunk size to 60KB to stay safely under the 64KB limit
const CHUNK_SIZE = 60000; 

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const key = url.pathname.slice(1); // e.g., 'image.png'

  // === CASE 1: Home Page (No filename) ===
  if (!key || key === "") {
    // Serve the index.html file directly from your project folder
    return serveFile(req, "./index.html");
  }

  // === CASE 2: Upload Image (PUT) ===
  if (req.method === 'PUT') {
    const data = new Uint8Array(await req.arrayBuffer());
    const contentType = req.headers.get('Content-Type') || 'application/octet-stream';
    
    // Calculate how many 60KB chunks we need to make
    const totalChunks = Math.ceil(data.length / CHUNK_SIZE);

    try {
      // Save all chunks concurrently
      const uploadPromises = [];
      for (let i = 0; i < totalChunks; i++) {
        const chunk = data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        uploadPromises.push(kv.set(["images", key, "chunk", i], chunk));
      }
      await Promise.all(uploadPromises);

      // Save metadata
      await kv.set(["images", key, "meta"], { contentType, totalChunks });

      return new Response('Saved successfully!', { status: 200 });
    } catch (error) {
      return new Response(`Failed to save: ${error.message}`, { status: 500 });
    }
  }

  // === CASE 3: View Image (GET) ===
  if (req.method === 'GET') {
    const metaEntry = await kv.get(["images", key, "meta"]);
    
    // If it's not in the database, return a 404
    if (!metaEntry.value) {
      return new Response('Image not found', { status: 404 });
    }

    const { contentType, totalChunks } = metaEntry.value as any;

    // Fetch all chunks concurrently
    const chunkPromises = [];
    for (let i = 0; i < totalChunks; i++) {
      chunkPromises.push(kv.get(["images", key, "chunk", i]));
    }
    const chunkEntries = await Promise.all(chunkPromises);

    // Reassemble the image chunks
    const chunks = chunkEntries.map(entry => entry.value as Uint8Array);
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const fullImage = new Uint8Array(totalLength);
    
    let offset = 0;
    for (const chunk of chunks) {
      if (chunk) {
        fullImage.set(chunk, offset);
        offset += chunk.length;
      }
    }

    return new Response(fullImage, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600' 
      }
    });
  }

  return new Response('Method not allowed', { status: 405 });
});
