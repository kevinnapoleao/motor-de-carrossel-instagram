import fs from 'fs/promises';
import path from 'path';
import { TrendHunter } from './radar/trendHunter.js';
import { TopicScorer, ScoredTopic } from './radar/topicScorer.js';
import { ContentLlmEngine } from './core/llm.js';
import { CarouselRenderer, RenderResult } from './carousel/renderer.js';
import { VideoAutoEditor, FullReelsProcessingResult } from './video/autoEditor.js';
import { PublishResult } from './distribution/socialEngine.js';
import { StateMachineService } from './core/stateMachine.js';
import { TelegramService } from './distribution/telegramService.js';
import { BrandDna, MultiFormatContent } from './core/types.js';

export interface AutonomousCycleResult {
  jobId: string;
  topic: string;
  rankedTopics: ScoredTopic[];
  content: MultiFormatContent;
  carousel: RenderResult;
  video: FullReelsProcessingResult;
  schedules: PublishResult[];
  newsletterMarkdown: string;
  status: string;
}

export class AutonomousEngine {
  /**
   * Executa o ciclo completo da agência autônoma de ponta a ponta
   */
  static async runFullCycle(customTopic?: string): Promise<AutonomousCycleResult> {
    const timestamp = Date.now();
    const jobId = `job_${timestamp}`;

    console.log('\n========================================================');
    console.log(`🚀 INICIANDO CICLO AUTÔNOMO COMPLETO [${jobId}]`);
    console.log('========================================================');

    // Carrega Brand DNA e Lore
    const brandPath = path.resolve(process.cwd(), 'config', 'brand_dna.json');
    const examplesPath = path.resolve(process.cwd(), 'config', 'examples.json');
    const brandDna: BrandDna = JSON.parse(await fs.readFile(brandPath, 'utf-8'));
    const examples = JSON.parse(await fs.readFile(examplesPath, 'utf-8'));

    const stateMachine = new StateMachineService();
    const telegram = new TelegramService();

    // ----------------------------------------------------
    // PASSO 1: RADAR DE TENDÊNCIAS & SELEÇÃO DE PAUTA
    // ----------------------------------------------------
    console.log('\n📡 [PASSO 1/5] Escaneando Radar de Tendências...');
    const trends = await TrendHunter.scanNicheTrends(['IA', 'Automação', 'Agentes']);
    const scorer = new TopicScorer();
    const ranked = scorer.scoreAndRankTopics(trends, brandDna);

    const selectedTopicTitle = customTopic || ranked[0].topic.title;
    console.log(`👉 Pauta Selecionada: "${selectedTopicTitle}" (Afinidade: ${ranked[0].affinityScore}%)`);

    stateMachine.createJob(jobId, selectedTopicTitle);

    // ----------------------------------------------------
    // PASSO 2: MOTOR DE COPYWRITING & INTELIGÊNCIA EDITORIAL
    // ----------------------------------------------------
    console.log('\n✍️ [PASSO 2/5] Gerando Conteúdo Multi-Formato com Brand Lore de Kevin...');
    const llm = new ContentLlmEngine();
    const content = await llm.generateContent({
      topic: selectedTopicTitle,
      brandDna,
      examples
    });

    // ----------------------------------------------------
    // PASSO 3: ESTÚDIO VISUAL EDITORIAL (CAPA 3D MAGAZINE & SLIDES)
    // ----------------------------------------------------
    console.log('\n🎨 [PASSO 3/5] Renderizando Carrossel 3D Retina (Bodoni Moda / 2160x2700)...');
    const carouselResult = await CarouselRenderer.renderCarousel(content.carousel, brandDna);

    // ----------------------------------------------------
    // PASSO 4: MOTOR DE VÍDEO (JUMP CUTS + LEGENDAS ANIMADAS 9:16)
    // ----------------------------------------------------
    console.log('\n🎬 [PASSO 4/5] Processando Vídeo com FFmpeg (Jump Cuts + Legendas 9:16 + -14 LUFS)...');
    const videoEditor = new VideoAutoEditor();
    const rawVideosDir = path.resolve(process.cwd(), 'inputs', 'raw_videos');
    const videoOutputDir = path.resolve(process.cwd(), 'output', 'video_reels');
    await fs.mkdir(rawVideosDir, { recursive: true });
    await fs.mkdir(videoOutputDir, { recursive: true });

    const rawFiles = await fs.readdir(rawVideosDir);
    const videoFile = rawFiles.find(f => /\.(mp4|mov|mkv|webm)$/i.test(f));
    let targetRawVideo: string;

    if (videoFile) {
      targetRawVideo = path.join(rawVideosDir, videoFile);
      console.log(`  📹 Usando vídeo bruto do usuário: ${videoFile}`);
    } else {
      console.log('  🧪 Usando vídeo vertical de teste 9:16 sintetizado...');
      targetRawVideo = path.join(videoOutputDir, 'sample_raw_test.mp4');
      await videoEditor.generateSampleTestVideo(targetRawVideo);
    }

    const videoResult = await videoEditor.processFullReels(targetRawVideo, videoOutputDir);

    // ----------------------------------------------------
    // PASSO 5: DISTRIBUIÇÃO MULTI-REDES & NEWSLETTER
    // ----------------------------------------------------
    console.log('\n📅 [PASSO 5/5] Preparando o pacote e aguardando sua aprovação...');
    // Nenhuma chamada de agendamento/publicação acontece durante a geração.
    // A integração social só é acionada pelo endpoint de aprovação explícita do Cockpit.
    const schedules: PublishResult[] = [];

    // Newsletter Semanal
    const newsletterPath = path.join(carouselResult.outputDir, 'NEWSLETTER_SEMANAL.md');
    const newsletterMarkdown = `# 📰 NEWSLETTER SEMANAL // EDIÇÃO #${jobId}
**Autor:** ${brandDna.creator.name} (${brandDna.creator.handle})  
**Assunto:** ${content.newsletter.subject}  
**Preview:** ${content.newsletter.previewText}  

---

${content.newsletter.bodyMarkdown}

---
*Rascunho local gerado pelo Motor de Conteúdo IA. Revise antes de publicar.*
`;
    await fs.writeFile(newsletterPath, newsletterMarkdown, 'utf-8');

    // Atualiza State Machine para AWAITING_APPROVAL
    stateMachine.updateJobContent(jobId, {
      reelsScript: content.reels,
      carouselData: content.carousel,
      linkedinPost: content.linkedin,
      blogPost: content.blog,
      newsletter: content.newsletter,
      outputDir: carouselResult.outputDir
    });

    // Notificação Telegram em Standby (configurada mas inativa)
    telegram.sendApprovalCard({
      jobId,
      topic: selectedTopicTitle,
      reelsScriptSnippet: content.reels.hook
    });

    console.log('\n========================================================');
    console.log(`✅ CICLO AUTÔNOMO FINALIZADO COM SUCESSO!`);
    console.log(`📌 ID do Trabalho: ${jobId}`);
    console.log(`📁 Pasta do Carrossel 3D: ${carouselResult.outputDir}`);
    console.log(`🎥 Vídeo MP4 Final: ${videoResult.finalVideo}`);
    console.log('🛡️ Nenhuma rede foi agendada; conteúdo aguardando aprovação humana no Cockpit.');
    console.log('========================================================\n');

    return {
      jobId,
      topic: selectedTopicTitle,
      rankedTopics: ranked,
      content,
      carousel: carouselResult,
      video: videoResult,
      schedules,
      newsletterMarkdown,
      status: 'AWAITING_APPROVAL'
    };
  }
}
