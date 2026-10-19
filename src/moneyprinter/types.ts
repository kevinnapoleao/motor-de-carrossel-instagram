export type VideoOrientation = 'portrait' | 'landscape'; // portrait = 1080x1920 (9:16), landscape = 1920x1080 (16:9)

export interface MoneyPrinterConfig {
  videoSubject: string;
  videoScript?: string;
  videoOrientation: VideoOrientation;
  voiceName: string; // e.g. "pt-BR-AntonioNeural" or "pt-BR-FranciscaNeural"
  voiceRate?: string; // e.g. "+0%"
  bgmVolume?: number; // 0.0 to 1.0, e.g. 0.15
  pexelsApiKey?: string;
  targetDurationSeconds?: number;
}

export interface MoneyPrinterTask {
  id: string;
  subject: string;
  status: 'PENDING' | 'GENERATING_SCRIPT' | 'SYNTHESIZING_VOICE' | 'FETCHING_FOOTAGE' | 'RENDERING' | 'COMPLETED' | 'FAILED';
  progress: number; // 0 to 100
  orientation: VideoOrientation;
  voiceName: string;
  script?: string;
  audioPath?: string;
  videoPath?: string;
  videoUrl?: string;
  audioDurationSeconds?: number;
  footageClipsCount?: number;
  error?: string;
  createdAt: string;
  completedAt?: string;
}
