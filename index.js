const express = require('express');
const cors = require('cors');
const ytdl = require('ytdl-core');
const { pipeline } = require('stream');
const NodeCache = require('node-cache');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(morgan('tiny'));

const cache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  message: 'Too many requests, please try again later.',
});

// Apply rate limiter to all requests except for '/ping'
app.use((req, res, next) => {
  if (req.path !== '/ping') {
    return generalLimiter(req, res, next);
  }
  next();
});

app.get('/ping', (req, res) => {
  res.send('pong');
});

const downloadMedia = async (url, type, res) => {
  try {
    if (!ytdl.validateURL(url)) {
      return res.status(400).send('Invalid YouTube URL');
    }

    const videoId = ytdl.getURLVideoID(url);
    let videoInfo = cache.get(videoId);

    if (!videoInfo) {
      videoInfo = await ytdl.getInfo(url);
      cache.set(videoId, videoInfo);
    }

    const title = videoInfo.videoDetails.title.replace(/[^\x00-\x7F]/g, "");

    const options = {
      quality: type === 'mp3' ? 'highestaudio' : 'highestvideo',
      filter: (format) => format.container === (type === 'mp3' ? 'mp3' : 'mp4'),
    };

    const stream = ytdl(url, options);

    res.header('Content-Disposition', `attachment; filename="${title}.${type}"`);
    res.header('Content-Type', type === 'mp3' ? 'audio/mpeg' : 'video/mp4');

    pipeline(stream, res, (err) => {
      if (err) {
        console.error(`Error downloading ${type.toUpperCase()}:`, err);
        if (!res.headersSent) {
          res.status(500).send(`Error downloading ${type.toUpperCase()}: ${err.message}`);
        }
      }
    });
  } catch (err) {
    console.error(`Error downloading ${type.toUpperCase()}:`, err);
    if (err.statusCode === 429) {
      res.status(429).send('Rate limit exceeded. Please try again later.');
    } else if (err.statusCode === 403) {
      res.status(403).send('Access forbidden. The server is refusing to fulfill the request.');
    } else {
      if (!res.headersSent) {
        res.status(500).send(`Error downloading ${type.toUpperCase()}: ${err.message}`);
      }
    }
  }
};

app.get('/downloadmp3', (req, res) => {
  const url = req.query.url;
  downloadMedia(url, 'mp3', res);
});

app.get('/downloadmp4', (req, res) => {
  const url = req.query.url;
  downloadMedia(url, 'mp4', res);
});

app.get('/', (req, res) => {
  res.send('Welcome to the YouTube downloader server!');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
