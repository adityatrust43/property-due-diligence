
const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

// The port the container will listen on.
// Google Cloud Run provides this as an environment variable.
const PORT = process.env.PORT || 8080;

// --- Debugging: Log information about the container environment ---
console.log(`--- Server starting up at ${new Date().toISOString()} ---`);
console.log(`Node.js version: ${process.version}`);
console.log(`Current working directory: ${process.cwd()}`);

// List files in the current directory to verify deployment contents.
fs.readdir(__dirname, (err, files) => {
    if (err) {
        console.error('Error reading application directory:', err);
    } else {
        console.log(`Files in application directory (__dirname: ${__dirname}):`, files);
    }
});
// --- End Debugging ---


// Your application uses modern JS modules (.tsx) directly in the browser.
// We need to ensure they are served with the correct JavaScript MIME type.
const options = {
  setHeaders: function (res, filePath) {
    if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      // Serve .ts and .tsx files as JavaScript so the browser module loader can execute them.
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    }
  }
};

// Serve static files from the project's root directory.
app.use(express.static(__dirname, options));

// For any route that is not a static file, serve the main index.html.
// This is essential for Single Page Applications (SPAs) to handle client-side routing.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Server is running and listening on port ${PORT}`);
  console.log('Container should now be ready to accept connections.');
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server.');
  process.exit(0);
});
