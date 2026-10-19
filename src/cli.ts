import fs from 'fs/promises';
import path from 'path';
import { ContentLlmEngine } from './core/llm.js';
import { CarouselRenderer } from './carousel/renderer.js';
import { BrandDna } from './core/types.js';
import { StateMachineService } from './core/stateMachine.js';

export async function runJob(topicInput?: string): Promise<{ jobId: string; outputDir: string; status: string }> {
  const stateMachine = new StateMachineService();
  const brandPath = path.resolve(process.cwd(), 'config', 'brand_dna.json');
  const examplesPath = path.resolve(process.cwd(), 'config', 'examples.json');

  const brandDna: BrandDna = JSON.parse(await fs.readFile(brandPath, 'utf-8'));
  const examples = JSON.parse(await fs.readFile(examplesPath, 'utf-8'));

  const topic = topicInput || 'Como construir um motor autônomo que cria e edita conteúdo no seu lugar';
  const jobId = `job_${Date.now()}`;

  console.log(`[Job ${jobId}] Criando trabalho no estado TOPIC_SELECTED...`);
  stateMachine.createJob(jobId, topic);

  console.log(`[Job ${jobId}] Gerando conteúdo multi-formato...`);
  const llmEngine = new ContentLlmEngine();
  const content = await llmEngine.generateContent({
    topic,
    brandDna,
    examples
  });

  console.log(`[Job ${jobId}] Renderizando carrossel programático...`);
  const renderResult = await CarouselRenderer.renderCarousel(content.carousel, brandDna);

  const textsPath = path.join(renderResult.outputDir, 'conteudo_completo.json');
  const markdownReportPath = path.join(renderResult.outputDir, 'ROTEIROS_E_POSTS.md');

  await fs.writeFile(textsPath, JSON.stringify(content, null, 2), 'utf-8');

  const markdownReport = `# PACOTE COMPLETO DE CONTEÚDO (Job: ${jobId})
**Tema:** ${content.topic}
**Status:** AGUARDANDO_APROVACAO
**Data:** ${new Date().toLocaleString('pt-BR')}

---

## 🎬 1. Roteiro de Reels / TikTok / Shorts
**Gancho (0-3s):** ${content.reels.hook}

**Roteiro Falado:**
${content.reels.body}

**Notas Visuais de Edição:**
${content.reels.visualNotes}

**CTA:** ${content.reels.cta}

---

## 🖼️ 2. Carrossel para Instagram (1080x1350)
${content.carousel.slides.map((s, idx) => `- Slide ${idx + 1} (${s.type}): ${s.headline}`).join('\n')}

---

## 💼 3. Post para o LinkedIn
\`\`\`
${content.linkedin}
\`\`\`

---

## 📝 4. Artigo para o Blog
# ${content.blog.title}
*Meta Description:* ${content.blog.metaDescription}

${content.blog.markdown}

---

## ✉️ 5. Rascunho da Newsletter
**Assunto:** ${content.newsletter.subject}
**Preview:** ${content.newsletter.previewText}

${content.newsletter.bodyMarkdown}
`;

  await fs.writeFile(markdownReportPath, markdownReport, 'utf-8');

  // Atualiza estado para AWAITING_APPROVAL
  stateMachine.updateJobContent(jobId, {
    reelsScript: content.reels,
    carouselData: content.carousel,
    linkedinPost: content.linkedin,
    blogPost: content.blog,
    newsletter: content.newsletter,
    outputDir: renderResult.outputDir
  });

  console.log(`[Job ${jobId}] Conteúdo pronto e persistido em AWAITING_APPROVAL.`);
  return { jobId, outputDir: renderResult.outputDir, status: 'AWAITING_APPROVAL' };
}

// Se for executado diretamente via terminal
if (process.argv[1]?.endsWith('cli.ts')) {
  const args = process.argv.slice(2);
  const topicArg = args.join(' ').trim();
  runJob(topicArg).catch((err) => {
    console.error('Erro na execução:', err);
    process.exit(1);
  });
}
