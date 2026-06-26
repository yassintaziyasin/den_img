<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Deno KV Image Uploader</title>
  <link rel="stylesheet" href="https://demo-styles.deno.deno.net/styles.css">
  <style>
    main { text-align: center; margin-top: 50px; }
    input[type="file"] { margin: 20px 0; }
    #status { margin-top: 20px; font-weight: bold; }
  </style>
</head>
<body>
  <main>
    <h1>Deno SQL Uploader</h1>
    <p>Select an image to upload.</p>
    
    <input type="file" id="fileInput" />
    <br/>
    <button onclick="upload()">Upload Image</button>
    <div id="status"></div>
  </main>

  <script>
    // --- NEW: Function to generate a random 10-character string ---
    function generateRandomString(length) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    }

    async function upload() {
      const fileInput = document.getElementById('fileInput');
      const file = fileInput.files[0];
      if (!file) return alert('Please select a file');

      // --- NEW: Create the new random file name ---
      // 1. Get the original file extension (e.g., 'png' or 'jpg')
      const extension = file.name.split('.').pop();
      // 2. Combine the 10-character string with the extension
      const randomFileName = generateRandomString(10) + '.' + extension;

      document.getElementById('status').innerText = 'Uploading...';
      
      // --- UPDATED: Send to the new randomFileName instead of file.name ---
      const response = await fetch('/' + randomFileName, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      });

      if (response.ok) {
        // --- UPDATED: Show the link using the new randomFileName ---
        document.getElementById('status').innerHTML = 
          'Success! View image: <a href="/' + randomFileName + '" target="_blank">' + randomFileName + '</a>';
      } else {
        const errorText = await response.text();
        document.getElementById('status').innerText = 'Error: ' + errorText;
      }
    }
  </script>
</body>
</html>
