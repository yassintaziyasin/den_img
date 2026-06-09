import { serveFile } from "jsr:@std/http/file-server";
import { Pool } from "npm:pg";

// Deno Deploy automatically injects the SQL connection details in the background.
// We just initialize the Pool and it connects instantly with zero configuration!
const pool = new Pool();

// Unlike KV, SQL databases need tables. We run this when the server starts
// to ensure our "images" table exists before anyone tries to upload.
await pool.query(`
  CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY,
    data BYTEA,
    content_type TEXT
  );
`);

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const key = url.pathname.slice(1); // e.g., 'image.png'

  // === CASE 1: Home Page ===
  if (!key || key === "") {
    return serveFile(req, "./index.html");
  }

  // === CASE 2: Upload Image (PUT) ===
  if (req.method === 'PUT') {
    // Read the file data in one piece (No chunking needed!)
    const data = new Uint8Array(await req.arrayBuffer());
    const contentType = req.headers.get('Content-Type') || 'application/octet-stream';
    
    try {
      // Save the file into the Postgres database. 
      // ON CONFLICT ensures that if an image with the same name exists, it gets overwritten.
      await pool.query(
        `INSERT INTO images (id, data, content_type) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (id) DO UPDATE 
         SET data = EXCLUDED.data, content_type = EXCLUDED.content_type`,
        [key, data, contentType]
      );

      return new Response('Saved successfully to SQL!', { status: 200 });
    } catch (error: any) {
      return new Response(`Failed to save: ${error.message}`, { status: 500 });
    }
  }

  // === CASE 3: View Image (GET) ===
  if (req.method === 'GET') {
    try {
      // Look up the image by its ID
      const result = await pool.query(
        `SELECT data, content_type FROM images WHERE id = $1`, 
        [key]
      );

      // If no rows were returned, the image doesn't exist
      if (result.rows.length === 0) {
        return new Response('Image not found', { status: 404 });
      }

      // Grab the first (and only) matching row
      const row = result.rows[0];
      
      // Serve the image back to the browser
      return new Response(new Uint8Array(row.data), {
        headers: {
          'Content-Type': row.content_type,
          'Cache-Control': 'public, max-age=3600' 
        }
      });
    } catch (error: any) {
       return new Response(`Error retrieving image: ${error.message}`, { status: 500 });
    }
  }

  return new Response('Method not allowed', { status: 405 });
});
