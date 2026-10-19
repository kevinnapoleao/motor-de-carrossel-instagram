import ffmpegStatic from 'ffmpeg-static';
import { execFile } from 'child_process';

const ffmpeg = ffmpegStatic || 'ffmpeg';

execFile(ffmpeg, ['-filters'], (err, stdout) => {
  if (err) {
    console.error('Error checking filters:', err);
    return;
  }
  console.log('Filters check:');
  console.log('- subtitles:', stdout.includes('subtitles'));
  console.log('- ass:', stdout.includes('ass'));
  console.log('- loudnorm:', stdout.includes('loudnorm'));
  console.log('- silencedetect:', stdout.includes('silencedetect'));
});
