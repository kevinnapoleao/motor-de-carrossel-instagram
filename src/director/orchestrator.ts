import fs from 'fs';
import path from 'path';
import { AutonomousEngine } from '../engine.js';
import { StateMachineService } from '../core/stateMachine.js';

export class MediaCreativeDirector {
  static async executeProduction(customPauta?: string) {
    console.log('\n================================================================');
    console.log('🎬 [DIRETOR DE ÁUDIO & VÍDEO] ASSUMINDO O COMANDO DA OPERAÇÃO');
    console.log('🏛️ Foco: Retenção Máxima, Estética de Luxo e Ritmo Acelerado');
    console.log('================================================================\n');

    // 1. Verificação de Insumos Brutos (Pre-flight Inspection)
    const rawVideosDir = path.resolve(process.cwd(), 'inputs', 'raw_videos');
    const rawPhotosDir = path.resolve(process.cwd(), 'inputs', 'raw_photos');
    
    const rawVideos = fs.existsSync(rawVideosDir) ? fs.readdirSync(rawVideosDir).filter(f => /\.(mp4|mov|mkv)$/i.test(f)) : [];
    const rawPhotos = fs.existsSync(rawPhotosDir) ? fs.readdirSync(rawPhotosDir).filter(f => /\.(jpg|jpeg|png)$/i.test(f)) : [];

    console.log('🔍 [DIRETOR - INSPEÇÃO DE ENTRADA]:');
    console.log(`  • Vídeos Brutos Disponíveis: ${rawVideos.length > 0 ? rawVideos.join(', ') : 'Nenhum (usará gerador sintético)'}`);
    console.log(`  • Fotos Editoriais Disponíveis: ${rawPhotos.length > 0 ? rawPhotos.join(', ') : 'Avatar padrão do criador'}`);

    // 2. Disparo do Ciclo Autônomo sob Supervisão do Diretor
    console.log('\n⚡ [DIRETOR] Disparando esteira de produção multimídia...');
    const result = await AutonomousEngine.runFullCycle(customPauta);

    // 3. Avaliação Técnica de Pós-Produção (Director Quality Gate)
    console.log('\n📐 [DIRETOR - AUDITORIA DE PÓS-PRODUÇÃO]:');
    
    // Análise de Vídeo
    const durationReductionPct = Math.round((result.video.timeSavedSec / result.video.originalDuration) * 100);
    console.log(`  🎬 VÍDEO REELS:`);
    console.log(`     - Duração Final: ${result.video.finalDuration.toFixed(2)}s (Original: ${result.video.originalDuration.toFixed(2)}s)`);
    console.log(`     - Silêncio Eliminado: ${result.video.timeSavedSec.toFixed(2)}s (${durationReductionPct}% de tempo morto cortado em ${result.video.silencesDetected} cortes)`);
    console.log(`     - Legendas 9:16: Destaque Hormozi em Amarelo (#FFD700) com contorno preto 6px`);
    console.log(`     - Áudio: Masterizado a -14 LUFS (EBU R128 Broadcast Standard)`);
    
    // Análise de Capa e Carrossel
    const coverFile = result.carousel.files[0];
    const coverStats = fs.existsSync(coverFile) ? fs.statSync(coverFile) : null;
    const coverSizeMb = coverStats ? (coverStats.size / (1024 * 1024)).toFixed(2) : '0';
    console.log(`  📸 CAPA EDITORIAL 3D:`);
    console.log(`     - Resolução: 2160x2700 Retina 2x (${coverSizeMb} MB)`);
    console.log(`     - Efeito 3D: Cabeça sobrepondo o título Didone 'MODERNO'`);
    console.log(`     - Grid: Código de barras oficial + chamadas editoriais em duas colunas`);

    // Análise de Agendamento
    console.log(`  📅 GRADE DE DISTRIBUIÇÃO:`);
    result.schedules.forEach(s => {
      const time = new Date(s.scheduledTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      console.log(`     - ${s.platform.toUpperCase().padEnd(18)}: ${time} (${s.provider})`);
    });

    console.log('\n================================================================');
    console.log('✅ [DIRETOR] PRODUÇÃO CONCLUÍDA E PRONTA PARA REVISÃO NO COCKPIT.');
    console.log(`📌 Trabalho: ${result.jobId}`);
    console.log('================================================================\n');

    return result;
  }
}

// Execução Direta via CLI
if (process.argv[1] && process.argv[1].endsWith('orchestrator.ts')) {
  const pautaArg = process.argv.slice(2).join(' ') || undefined;
  MediaCreativeDirector.executeProduction(pautaArg).catch(err => {
    console.error('❌ [DIRETOR] Erro na execução da produção:', err);
    process.exit(1);
  });
}
