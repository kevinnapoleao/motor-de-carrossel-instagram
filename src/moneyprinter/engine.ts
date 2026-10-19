import fs from 'node:fs/promises';
import path from 'node:path';
import { MoneyPrinterConfig, MoneyPrinterTask } from './types.js';
import { VoiceService } from './voiceService.js';
import { PexelsService } from './pexelsService.js';
import { VideoCompositor } from './videoCompositor.js';

export class MoneyPrinterEngine {
  private baseOutputDir: string;
  private tasks: Map<string, MoneyPrinterTask> = new Map();

  constructor(outputDir?: string) {
    this.baseOutputDir = outputDir || path.resolve(process.cwd(), 'output', 'moneyprinter');
  }

  async listTasks(): Promise<MoneyPrinterTask[]> {
    return Array.from(this.tasks.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getTask(id: string): MoneyPrinterTask | undefined {
    return this.tasks.get(id);
  }

  /**
   * Gera o roteiro curto baseado no tema.
   * Se GEMINI_API_KEY estiver configurada, pode chamar Gemini, caso contrário gera um roteiro dinâmico e conciso.
   */
  private generateScript(subject: string): string {
    return `Você já percebeu como a tecnologia avança rápido quando o assunto é ${subject}? A maioria das pessoas ainda não entendeu o verdadeiro impacto disso na produtividade. Quem dominar essa mudança agora, sai na frente e transforma horas de trabalho em minutos. Salve esse vídeo e me conte nos comentários o que você acha.`;
  }

  /**
   * Pipeline de execução assíncrona isolada do MoneyPrinter Turbo.
   */
  async startTask(config: MoneyPrinterConfig): Promise<MoneyPrinterTask> {
    const taskId = `mpt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const taskDir = path.join(this.baseOutputDir, taskId);
    await fs.mkdir(taskDir, { recursive: true });

    const task: MoneyPrinterTask = {
      id: taskId,
      subject: config.videoSubject,
      status: 'PENDING',
      progress: 5,
      orientation: config.videoOrientation || 'portrait',
      voiceName: config.voiceName || 'pt-BR-AntonioNeural',
      createdAt: new Date().toISOString(),
    };

    this.tasks.set(taskId, task);

    // Disparar o pipeline em segundo plano sem travar a requisição
    this.runPipeline(task, config, taskDir).catch((err) => {
      console.error(`[MoneyPrinter] Falha na tarefa ${taskId}:`, err);
      task.status = 'FAILED';
      task.error = err.message || 'Erro desconhecido durante a geração do vídeo.';
    });

    return task;
  }

  private async runPipeline(
    task: MoneyPrinterTask,
    config: MoneyPrinterConfig,
    taskDir: string
  ): Promise<void> {
    try {
      // 1. Roteiro
      task.status = 'GENERATING_SCRIPT';
      task.progress = 15;
      const script = config.videoScript && config.videoScript.trim().length > 0
        ? config.videoScript.trim()
        : this.generateScript(config.videoSubject);
      task.script = script;
      await fs.writeFile(path.join(taskDir, 'script.txt'), script, 'utf8');

      // 2. Síntese de Voz (Edge-TTS)
      task.status = 'SYNTHESIZING_VOICE';
      task.progress = 35;
      const voiceRes = await VoiceService.synthesizeWithEdgeTts(
        script,
        task.voiceName,
        taskDir,
        'narration'
      );
      task.audioPath = voiceRes.audioPath;
      task.audioDurationSeconds = voiceRes.durationSeconds;

      // 3. Obtenção de Material (Pexels ou Procedural Background)
      task.status = 'FETCHING_FOOTAGE';
      task.progress = 55;
      const pexels = new PexelsService(config.pexelsApiKey);
      let footagePath: string;

      if (pexels.hasApiKey()) {
        const keywords = config.videoSubject.split(' ').filter(w => w.length > 3).slice(0, 2).join(' ') || 'technology';
        const videoUrls = await pexels.searchVideos(keywords, task.orientation, 1);
        if (videoUrls.length > 0) {
          const downloadedClip = path.join(taskDir, 'stock_clip.mp4');
          const ok = await pexels.downloadVideo(videoUrls[0], downloadedClip);
          if (ok) {
            footagePath = downloadedClip;
            task.footageClipsCount = 1;
          } else {
            footagePath = path.join(taskDir, 'procedural_bg.mp4');
            await VideoCompositor.generateProceduralBackground(task.audioDurationSeconds, task.orientation, footagePath);
          }
        } else {
          footagePath = path.join(taskDir, 'procedural_bg.mp4');
          await VideoCompositor.generateProceduralBackground(task.audioDurationSeconds, task.orientation, footagePath);
        }
      } else {
        footagePath = path.join(taskDir, 'procedural_bg.mp4');
        await VideoCompositor.generateProceduralBackground(task.audioDurationSeconds, task.orientation, footagePath);
      }

      // 4. Geração de Legendas ASS
      const assPath = path.join(taskDir, 'subtitles.ass');
      await VideoCompositor.generateAssSubtitles(voiceRes.timestamps, task.orientation, assPath);

      // 5. Renderização e Composição Final
      task.status = 'RENDERING';
      task.progress = 80;
      const finalMp4Path = path.join(taskDir, 'moneyprinter_final.mp4');

      await VideoCompositor.renderFinalVideo({
        bgVideoPath: footagePath,
        narrationAudioPath: voiceRes.audioPath,
        subtitlesAssPath: assPath,
        orientation: task.orientation,
        duration: voiceRes.durationSeconds,
        outputPath: finalMp4Path,
      });

      task.status = 'COMPLETED';
      task.progress = 100;
      task.videoPath = finalMp4Path;
      task.completedAt = new Date().toISOString();
    } catch (err: any) {
      task.status = 'FAILED';
      task.error = err.message || 'Erro durante o pipeline do MoneyPrinter';
      throw err;
    }
  }
}
