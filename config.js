const path = require('path');

module.exports = {
  // Server port
  port: process.env.PORT || 3321,

  // Directory for temporary file downloads
  downloadDir: process.env.DOWNLOAD_DIR || path.join(__dirname, 'downloads'),

  // Rate limiting settings
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  },

  // FFmpeg settings
  ffmpeg: {
    // Path to FFmpeg executable (if not in system PATH)
    // ffmpegPath: '/path/to/ffmpeg',

    // Default audio bitrate for MP3 conversion
    audioBitrate: '128k',

    // Default settings for GIF conversion
    gif: {
      duration: 5,
      size: '320x240',
      fps: 10
    }
  },

  // YouTube download settings
  youtube: {
    // Quality settings
    audioQuality: 'highestaudio',
    videoQuality: 'highest'
  }
};
