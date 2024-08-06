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

    const info = await ytdl.getInfo(url);
    const format = ytdl.chooseFormat(info.formats, { quality: type });

    if (!format) {
      return res.status(400).send('Format not found');
    }

    res.header('Content-Disposition', `attachment; filename="${info.videoDetails.title}.${format.container}"`);
    pipeline(ytdl(url, { format }), res, (err) => {
      if (err) {
        console.error('Pipeline failed.', err);
      }
    });
  } catch (error) {
    console.error('Error downloading media:', error);
    res.status(500).send('Error downloading media');
  }
};

app.get('/download', async (req, res) => {
  const { url, type } = req.query;
  if (!url || !type) {
    return res.status(400).send('URL and type are required');
  }

  await downloadMedia(url, type, res);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
