import fs from 'fs/promises';
import path from 'path';
import { TrendHunter } from './trendHunter.js';
import { TopicScorer } from './topicScorer.js';
import { ContentLlmEngine } from '../core/llm.js';
import { StateMachineService } from '../core/stateMachine.js';
import { BrandDna } from '../core/types.js';

async function runRadarTest() {
  console.log('📡 ========================================================');
  console.log('🎯 INICIANDO TESTE DO RADAR DE TENDÊNCIAS & IA (FASE 3)');
  console.log('========================================================\n');

  // 1. Carrega Brand DNA e Few-Shot Lore
  const brandPath = path.resolve(process.cwd(), 'config', 'brand_dna.json');
  const examplesPath = path.resolve(process.cwd(), 'config', 'examples.json');
  const brandDna: BrandDna = JSON.parse(await fs.readFile(brandPath, 'utf-8'));
  const examples = JSON.parse(await fs.readFile(examplesPath, 'utf-8'));

  // 2. Trend Hunter: Escaneia o mercado
  const trends = await TrendHunter.scanNicheTrends(['IA', 'Automação', 'Agentes Autônomos']);

  // 3. Topic Scorer: Cruza com histórico do SQLite e Brand DNA
  const scorer = new TopicScorer();
  const rankedTopics = scorer.scoreAndRankTopics(trends, brandDna);

  console.log('\n🏆 TOP 3 PAUTAS DO DIA RANQUEADAS POR AFINIDADE:');
  console.log('--------------------------------------------------------');
  rankedTopics.slice(0, 3).forEach((item, index) => {
    console.log(`[Pauta #${index + 1}] Afinidade: ${item.affinityScore}% | Ângulo: ${item.editorialAngle.toUpperCase()}`);
    console.log(`📌 Título: ${item.topic.title}`);
    console.log(`💡 Racional: ${item.rationale}`);
    console.log(`⚡ Fonte: ${item.topic.source} (Velocidade: ${item.topic.velocityScore}/100)\n`);
  });

  // 4. Seleciona a Pauta Campeã (#1) para geração imediata
  const topChoice = rankedTopics[0];
  console.log(`👑 Pauta Campeã Selecionada: "${topChoice.topic.title}"`);
  console.log('🤖 Disparando ContentLlmEngine com o Brand Lore de Kevin...\n');

  const llmEngine = new ContentLlmEngine();
  const generatedContent = await llmEngine.generateContent({
    topic: topChoice.topic.title,
    brandDna,
    examples
  });

  // 5. Registra o ciclo na State Machine do SQLite
  const sm = new StateMachineService();
  const jobId = `job_${Date.now()}`;
  sm.createJob(jobId, topChoice.topic.title);
  sm.updateJobContent(jobId, {
    reelsScript: generatedContent.reels,
    carouselData: generatedContent.carousel,
    linkedinPost: generatedContent.linkedin,
    blogPost: generatedContent.blog,
    newsletter: generatedContent.newsletter,
    outputDir: path.resolve(process.cwd(), 'output')
  });

  // 6. Salva resumo executivo em Markdown
  const outputDir = path.resolve(process.cwd(), 'output');
  await fs.mkdir(outputDir, { recursive: true });
  const summaryPath = path.join(outputDir, 'RADAR_PAUTA_DO_DIA.md');

  const markdownSummary = `# 📡 RADAR DE TENDÊNCIAS & PAUTA SELECIONADA
**Data:** ${new Date().toLocaleDateString('pt-BR')}  
**Status State Machine:** AWAITING_APPROVAL (ID: ${jobId})  
**Criador:** ${brandDna.creator.name} (${brandDna.creator.handle})  

---

## 🏆 TOP 3 PAUTAS DO DIA NO RADAR

${rankedTopics.slice(0, 3).map((item, idx) => `### ${idx + 1}. ${item.topic.title}
* **Score de Afinidade:** ${item.affinityScore}%
* **Velocidade do Tópico:** ${item.topic.velocityScore}/100
* **Ângulo Editorial:** \`${item.editorialAngle}\`
* **Fonte:** ${item.topic.source}
* **Racional Estratégico:** ${item.rationale}
`).join('\n')}

---

## 🚀 CONTEÚDO MULTI-FORMATO GERADO PARA A PAUTA #1

### 1. Roteiro de Reels
* **Hook:** ${generatedContent.reels.hook}
* **Corpo:** ${generatedContent.reels.body}
* **Notas Visuais:** ${generatedContent.reels.visualNotes}
* **CTA:** ${generatedContent.reels.cta}

### 2. Carrossel Editorial Magazine (Slides: ${generatedContent.carousel.slides.length})
* **Manchete de Capa:** ${generatedContent.carousel.slides[0].headline}
* **Subtítulo:** ${'subtitle' in generatedContent.carousel.slides[0] ? generatedContent.carousel.slides[0].subtitle : ''}

### 3. Post de LinkedIn
\`\`\`markdown
${generatedContent.linkedin}
\`\`\`

### 4. Artigo de Blog
* **Título:** ${generatedContent.blog.title}
* **Meta Description:** ${generatedContent.blog.metaDescription}

---
*Gerado autonomamente pelo Motor de Conteúdo IA.*
`;

  await fs.writeFile(summaryPath, markdownSummary, 'utf-8');

  console.log('📊 ========================================================');
  console.log('✅ TESTE DA FASE 3 CONCLUÍDO COM SUCESSO!');
  console.log('========================================================');
  console.log(`• Pauta #1 Selecionada com Afinidade: ${topChoice.affinityScore}%`);
  console.log(`• State Machine SQLite: Registro criado e aguardando aprovação (ID: ${jobId})`);
  console.log(`• Resumo Estratégico Salvo em:`);
  console.log(`  👉 ${summaryPath}`);
  console.log('========================================================\n');
}

runRadarTest().catch(console.error);
