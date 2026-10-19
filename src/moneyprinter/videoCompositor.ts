import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import fs from 'node:fs/promises';
import path from 'node:path';
import { TtsWordTimestamp } from './voiceService.js';
import { VideoOrientation } from './types.js';

export class VideoCompositor {
  private static getFfmpegBinary(): string {
    return (ffmpegPath as string) || 'ffmpeg';
  }

  /**
   * Converte a lista de palavras/tempos em arquivo de legenda ASS elegante.
   */
  static generateAssSubtitles(
    timestamps: TtsWordTimestamp[],
    orientation: VideoOrientation,
    outAssPath: string
  ): Promise<void> {
    const isPortrait = orientation === 'portrait';
    const width = isPortrait ? 1080 : 1920;
    const height = isPortrait ? 1920 : 1080;
    const fontSize = isPortrait ? 68 : 52;
    const marginV = isPortrait ? 280 : 120;

    let assContent = `[Script Info]
Title: MoneyPrinter Turbo Subtitles
ScriptType: v4.00+
WrapStyle: 0
PlayResX: ${width}
PlayResY: ${height}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Plus Jakarta Sans,${fontSize},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3.5,2.0,2,40,40,${marginV},1
Style: Highlight,Plus Jakarta Sans,${fontSize},&H002EFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,105,105,0,0,1,4.0,2.5,2,40,40,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    // Gerar uma linha de diálogo por frase/segmento com fade suave
    for (const item of timestamps) {
      const startStr = this.secondsToAssTime(item.start);
      const endStr = this.secondsToAssTime(item.end);
      const escaped = item.word.replace(/{/g, '').replace(/}/g, '').trim();
      if (escaped) {
        assContent += `Dialogue: 0,${startStr},${endStr},Default,,0,0,0,,{\\fad(60,60)}${escaped}\n`;
      }
    }

    return fs.writeFile(outAssPath, assContent, 'utf8');
  }

  /**
   * Gera um clipe procedural dinâmico (background motion com gradiente e ondas)
   * caso o usuário não tenha clipes de stock baixados ou não tenha Pexels API Key.
   */
  static async generateProceduralBackground(
    duration: number,
    orientation: VideoOrientation,
    destPath: string
  ): Promise<void> {
    const isPortrait = orientation === 'portrait';
    const width = isPortrait ? 1080 : 1920;
    const height = isPortrait ? 1920 : 1080;
    const ffmpeg = this.getFfmpegBinary();

    return new Promise<void>((resolve, reject) => {
      const args = [
        '-y',
        '-f', 'lavfi',
        '-i', `color=c=0x0d1117:s=${width}x${height}:d=${duration.toFixed(2)}:r=30`,
        '-f', 'lavfi',
        '-i', `testsrc2=s=${width}x${height}:d=${duration.toFixed(2)}:r=30`,
        '-filter_complex', `[1:v]hue=s=0.2:h=210,boxblur=30:5[waves];[0:v][waves]blend=all_mode=addition:all_opacity=0.35[outv]`,
        '-map', '[outv]',
        '-t', duration.toFixed(2),
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'veryfast',
        destPath
      ];

      const proc = spawn(ffmpeg, args);
      let errLog = '';
      proc.stderr.on('data', (d) => { errLog += d.toString(); });
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Erro ao gerar background procedural: ${errLog.slice(-400)}`));
      });
      proc.on('error', reject);
    });
  }

  /**
   * Renderiza a composição final unindo vídeo de fundo, áudio de locução e legendas.
   */
  static async renderFinalVideo(params: {
    bgVideoPath: string;
    narrationAudioPath: string;
    subtitlesAssPath?: string;
    orientation: VideoOrientation;
    duration: number;
    outputPath: string;
  }): Promise<void> {
    const isPortrait = params.orientation === 'portrait';
    const width = isPortrait ? 1080 : 1920;
    const height = isPortrait ? 1920 : 1080;
    const ffmpeg = this.getFfmpegBinary();

    // Filtros de vídeo: ajustar escala, corte e queimar legendas se fornecidas
    let vf = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
    if (params.subtitlesAssPath) {
      // Normalizar caminho para o filtro ass do ffmpeg no Windows
      const normalizedAss = params.subtitlesAssPath.replace(/\\/g, '/').replace(/:/g, '\\:');
      vf += `,ass='${normalizedAss}'`;
    }

    const args = [
      '-y',
      '-stream_loop', '-1',
      '-i', params.bgVideoPath,
      '-i', params.narrationAudioPath,
      '-t', params.duration.toFixed(2),
      '-vf', vf,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '22',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-pix_fmt', 'yuv420p',
      '-shortest',
      params.outputPath
    ];

    return new Promise<void>((resolve, reject) => {
      const proc = spawn(ffmpeg, args);
      let errLog = '';
      proc.stderr.on('data', (d) => { errLog += d.toString(); });
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Erro ao renderizar vídeo final do MoneyPrinter: ${errLog.slice(-500)}`));
      });
      proc.on('error', reject);
    });
  }

  private static secondsToAssTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const cs = Math.floor((seconds % 1) * 100);
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  }
}
