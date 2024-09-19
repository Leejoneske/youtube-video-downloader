const express = require('express');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3321;

app.use(express.json());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// Ensure download directory exists
const downloadDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadDir)) {
  fs.mkdirSync(downloadDir);
}

// Helper function to get video info
async function getVideoInfo(url) {
  try {
    return await ytdl.getInfo(url);
  } catch (error) {
    console.error('Error fetching video info:', error);
    throw new Error('Invalid YouTube URL');
  }
}

// Helper function for file download
function downloadFile(res, filePath, fileName, contentType) {
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Content-Type', contentType);
  res.download(filePath, fileName, (err) => {
    if (err) {
      console.error('Error sending file:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error downloading file' });
      }
    }
    fs.unlink(filePath, (unlinkErr) => {
      if (unlinkErr) console.error('Error deleting file:', unlinkErr);
    });
  });
}

// Generic download handler
async function handleDownload(req, res, format, processFile) {
  const { query } = req.body;
  if (!query || !ytdl.validateURL(query)) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  try {
    const info = await getVideoInfo(query);
    const title = info.videoDetails.title.replace(/[^\w\s]/gi, '');
    const fileName = `${title}.${format}`;
    const filePath = path.join(downloadDir, `${uuidv4()}.${format}`);

    await processFile(query, filePath);
    downloadFile(res, filePath, fileName, format === 'gif' ? 'image/gif' : `application/${format}`);
  } catch (error) {
    console.error(`Error processing ${format} request:`, error);
    res.status(500).json({ error: error.message || 'Error processing request' });
  }
}

// MP3 download
app.post('/downloadmp3', (req, res) => {
  handleDownload(req, res, 'mp3', (url, outputPath) => {
    return new Promise((resolve, reject) => {
      const stream = ytdl(url, { quality: 'highestaudio' });
      ffmpeg(stream)
        .audioBitrate(128)
        .save(outputPath)
        .on('end', resolve)
        .on('error', reject);
    });
  });
});

// MP4 download
app.post('/downloadmp4', (req, res) => {
  handleDownload(req, res, 'mp4', (url, outputPath) => {
    return new Promise((resolve, reject) => {
      ytdl(url, { quality: 'highest' })
        .pipe(fs.createWriteStream(outputPath))
        .on('finish', resolve)
        .on('error', reject);
    });
  });
});

// GIF download
app.post('/downloadgif', (req, res) => {
  handleDownload(req, res, 'gif', (url, outputPath) => {
    return new Promise((resolve, reject) => {
      ffmpeg(ytdl(url))
        .setStartTime(0)
        .setDuration(5)
        .size('320x240')
        .fps(10)
        .save(outputPath)
        .on('end', resolve)
        .on('error', reject);
    });
  });
});

// Screenshot download
app.post('/downloadpscreen', (req, res) => {
  handleDownload(req, res, 'png', (url, outputPath) => {
    return new Promise((resolve, reject) => {
      ffmpeg(ytdl(url))
        .screenshots({
          count: 1,
          folder: path.dirname(outputPath),
          filename: path.basename(outputPath),
        })
        .on('end', resolve)
        .on('error', reject);
    });
  });
});

app.get('/ping', (req, res) => {
  res.send('pong');
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
