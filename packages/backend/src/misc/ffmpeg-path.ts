import * as fs from 'node:fs';

const ffmpegPaths = [
  '/usr/bin/ffmpeg',
  '/usr/local/bin/ffmpeg',
  '/opt/homebrew/bin/ffmpeg',  // macOS with Homebrew
  '/snap/bin/ffmpeg',          // Snap packages
  '/usr/local/ffmpeg/bin/ffmpeg', // Custom installations
];

const ffprobePaths = [
  '/usr/bin/ffprobe',
  '/usr/local/bin/ffprobe',
  '/opt/homebrew/bin/ffprobe',  // macOS with Homebrew
  '/snap/bin/ffprobe',          // Snap packages
  '/usr/local/ffmpeg/bin/ffprobe', // Custom installations
];

let ffmpegPath: string | null = null;
let ffprobePath: string | null = null;

export function findFFmpeg(): string {
  if (ffmpegPath) {
    return ffmpegPath;
  }

  for (const path of ffmpegPaths) {
    try {
      if (fs.existsSync(path)) {
        ffmpegPath = path;
        console.warn(`✅ FFmpeg found at: ${ffmpegPath}`);
        return ffmpegPath;
      }
    } catch (error) {
      // Continue checking other paths
      console.warn(`⚠️ Could not check path ${path}:`, error instanceof Error ? error.message : String(error));
    }
  }

  // If no FFmpeg found, log a warning but don't throw error
  // This allows the application to start without FFmpeg functionality
  console.warn('⚠️ FFmpeg not found. Video processing features will be disabled.');
  console.warn('To enable video processing, install FFmpeg: sudo dnf install ffmpeg (on RHEL/CentOS) or sudo apt install ffmpeg (on Ubuntu/Debian)');

  // Return a placeholder path that will cause graceful failures
  return '/usr/bin/ffmpeg-not-found';
}

export function findFFprobe(): string {
  if (ffprobePath) {
    return ffprobePath;
  }

  for (const path of ffprobePaths) {
    try {
      if (fs.existsSync(path)) {
        ffprobePath = path;
        console.warn(`✅ FFprobe found at: ${ffprobePath}`);
        return ffprobePath;
      }
    } catch (error) {
      // Continue checking other paths
      console.warn(`⚠️ Could not check path ${path}:`, error instanceof Error ? error.message : String(error));
    }
  }

  console.warn('⚠️ FFprobe not found. Video metadata features will be disabled.');
  return '/usr/bin/ffprobe-not-found';
}
