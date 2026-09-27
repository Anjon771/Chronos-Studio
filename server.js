const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

const staticDir = path.join(__dirname, 'responsive-clock-ui-main');
const generatedImagesDir = path.join(__dirname, 'src', 'assets', 'images');

app.use('/assets/images', express.static(generatedImagesDir));
app.use('/src/assets/images', express.static(generatedImagesDir));
app.use(express.static(staticDir));

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(staticDir, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
