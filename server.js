const http = require('http');
const fs = require('fs');
const path = require('path');
const port = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  const filePath = req.url === '/' ? 'index.html' : req.url;
  const fullPath = path.join(__dirname, filePath);
  
  fs.readFile(fullPath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('File not found');
    } else {
      res.writeHead(200);
      res.end(content);
    }
  });
});

server.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
