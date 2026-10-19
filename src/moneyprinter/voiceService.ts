import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface TtsWordTimestamp {
  word: string;
  start: number; // in seconds
  end: number;   // in seconds
}

export interface TtsSynthesisResult {
  audioPath: string;
  durationSeconds: number;
  timestamps: TtsWordTimestamp[];
}

export class VoiceService {
  /**
   * Sintetiza áudio via edge-tts usando o módulo python pré-instalado.
   * Gera o arquivo MP3 e extrai as marcações de tempo por frase/palavra (VTT/SRT).
   */
  static async synthesizeWithEdgeTts(
    text: string,
    voiceName: string = 'pt-BR-AntonioNeural',
    outputDir: string,
    prefix: string = 'narration'
  ): Promise<TtsSynthesisResult> {
    await fs.mkdir(outputDir, { recursive: true });
    const audioPath = path.join(outputDir, `${prefix}.mp3`);
    const srtPath = path.join(outputDir, `${prefix}.srt`);

    const pythonScript = `
import asyncio
import edge_tts
import sys

async def run():
    text = sys.argv[1]
    voice = sys.argv[2]
    out_audio = sys.argv[3]
    out_srt = sys.argv[4]
    
    communicate = edge_tts.Communicate(text, voice)
    submaker = edge_tts.SubMaker()
    
    with open(out_audio, "wb") as file:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                file.write(chunk["data"])
            elif chunk["type"] in ("WordBoundary", "SentenceBoundary"):
                submaker.feed(chunk)
                
    with open(out_srt, "w", encoding="utf-8") as f:
        f.write(submaker.get_srt())

asyncio.run(run())
`;

    const scriptPath = path.join(outputDir, `run_tts_${Date.now()}.py`);
    await fs.writeFile(scriptPath, pythonScript, 'utf8');

    try {
      await new Promise<void>((resolve, reject) => {
        const proc = spawn('python', [scriptPath, text, voiceName, audioPath, srtPath]);
        let stderr = '';
        proc.stderr.on('data', (d) => { stderr += d.toString(); });
        proc.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`edge-tts falhou com código ${code}: ${stderr}`));
        });
      });
    } finally {
      await fs.unlink(scriptPath).catch(() => undefined);
    }

    const duration = await this.getAudioDuration(audioPath);
    const timestamps = await this.parseSrt(srtPath);

    return {
      audioPath,
      durationSeconds: duration,
      timestamps,
    };
  }

  static async getAudioDuration(filePath: string): Promise<number> {
    try {
      // Usar ffprobe se disponível ou aproximação via ffmpeg
      return await new Promise<number>((resolve) => {
        const proc = spawn('ffprobe', [
          '-v', 'error',
          '-show_entries', 'format=duration',
          '-of', 'default=noprint_wrappers=1:nokey=1',
          filePath
        ]);
        let out = '';
        proc.stdout.on('data', (d) => { out += d.toString(); });
        proc.on('close', (code) => {
          if (code === 0 && Number(out.trim()) > 0) {
            resolve(Number(out.trim()));
          } else {
            // Fallback para 15 segundos se não conseguir inspecionar
            resolve(15);
          }
        });
        proc.on('error', () => resolve(15));
      });
    } catch {
      return 15;
    }
  }

  static async parseSrt(srtPath: string): Promise<TtsWordTimestamp[]> {
    try {
      const content = await fs.readFile(srtPath, 'utf8');
      const blocks = content.split(/\r?\n\r?\n/);
      const results: TtsWordTimestamp[] = [];

      for (const block of blocks) {
        const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length >= 2) {
          // Exemplo SRT: 00:00:00,100 --> 00:00:00,600
          const timeLine = lines[0].includes('-->') ? lines[0] : (lines[1].includes('-->') ? lines[1] : '');
          const textLine = lines[0].includes('-->') ? lines.slice(1).join(' ') : (lines[1].includes('-->') ? lines.slice(2).join(' ') : '');
          
          if (timeLine) {
            const match = timeLine.match(/(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})/);
            if (match) {
              const start = this.timeToSeconds(match[1].replace(',', '.'));
              const end = this.timeToSeconds(match[2].replace(',', '.'));
              const word = textLine.trim();
              if (word) {
                results.push({ word, start, end });
              }
            }
          }
        }
      }
      return results;
    } catch {
      return [];
    }
  }

  private static timeToSeconds(timeStr: string): number {
    const parts = timeStr.split(':');
    if (parts.length === 2) {
      const [m, s] = parts;
      return parseFloat(m) * 60 + parseFloat(s);
    }
    if (parts.length === 3) {
      const [h, m, s] = parts;
      return parseFloat(h) * 3600 + parseFloat(m) * 60 + parseFloat(s);
    }
    return 0;
  }
}
