import { VideoAutoEditor } from './autoEditor.js';
import fs from 'fs/promises';
import path from 'path';

async function runVideoEngineTest() {
  console.log('🎬 ========================================================');
  console.log('🚀 INICIANDO TESTE COMPLETO DO MOTOR DE VÍDEO (FASE 2)');
  console.log('========================================================\n');

  const editor = new VideoAutoEditor();
  const rawVideosDir = path.resolve(process.cwd(), 'inputs', 'raw_videos');
  const outputDir = path.resolve(process.cwd(), 'output', 'video_reels');
  await fs.mkdir(rawVideosDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });

  // 1. Verifica se o usuário já colocou um vídeo gravado na pasta
  const files = await fs.readdir(rawVideosDir);
  const videoFiles = files
    .filter(f => /\.(mp4|mov|mkv|webm)$/i.test(f))
    .sort((a, b) => (b.includes('19.29.14') || b.includes('192914') ? 1 : -1));

  let targetRawVideo: string;

  if (videoFiles.length > 0) {
    targetRawVideo = path.join(rawVideosDir, videoFiles[0]);
    console.log(`📹 Encontrado vídeo bruto do usuário: ${videoFiles[0]}`);
  } else {
    // 2. Sintetiza um vídeo vertical de teste 1080x1920 com pausas e silêncios intencionais
    console.log('ℹ️ Nenhum vídeo bruto encontrado em inputs/raw_videos/.');
    console.log('🧪 Sintetizando vídeo vertical 9:16 (1080x1920) com silêncios reais para validação do algoritmo...');
    const sampleVideoPath = path.join(outputDir, 'sample_raw_test.mp4');
    targetRawVideo = await editor.generateSampleTestVideo(sampleVideoPath);
    console.log(`✅ Vídeo de teste sintetizado: ${sampleVideoPath}`);
  }

  // 3. Executa o pipeline de edição autônoma completa
  const result = await editor.processFullReels(targetRawVideo, outputDir);

  console.log('\n📊 ========================================================');
  console.log('🏆 RELATÓRIO TÉCNICO DE PROCESSAMENTO DE VÍDEO (FASE 2):');
  console.log('========================================================');
  console.log(`• Vídeo Bruto: ${result.rawVideo}`);
  console.log(`• Silêncios Detectados e Eliminados: ${result.silencesDetected}`);
  console.log(`• Duração Original: ${result.originalDuration.toFixed(2)}s`);
  console.log(`• Duração Final Editada: ${result.finalDuration.toFixed(2)}s`);
  console.log(`• Tempo de Silêncio Cortado: ${result.timeSavedSec.toFixed(2)}s`);
  console.log(`• Legendas Queimadas: Formato ASS 9:16 com Realce em Ciano/Dourado`);
  console.log(`• Masterização de Áudio: EBU R128 (-14 LUFS para Instagram/TikTok)`);
  console.log(`• Arquivo Final Pronto para Publicação:`);
  console.log(`  👉 ${result.finalVideo}`);
  console.log('========================================================\n');
}

runVideoEngineTest().catch(console.error);
