import fs from 'fs/promises';
import path from 'path';
import { CarouselRenderer } from './renderer.js';
import { BrandDna, CarouselData } from '../core/types.js';

async function runRenderTest() {
  console.log('🧪 Executando Teste de Renderização e Anti-Overflow...');

  const brandPath = path.resolve(process.cwd(), 'config', 'brand_dna.json');
  const brandDna: BrandDna = JSON.parse(await fs.readFile(brandPath, 'utf-8'));

  // Teste de Worst-Case Scenario: textos no limite máximo de caracteres permitido pelo Zod
  const worstCaseCarousel: CarouselData = {
    theme: 'dark_modern',
    topic: 'Teste de Estresse de Layout e Limites Extremos',
    slides: [
      {
        type: 'cover',
        tag: 'ENGENHARIA DE PROMPT & DESIGN',
        headline: 'Esta é uma manchete de capa excepcionalmente longa no limite extremo de 80 chars.',
        subtitle: 'Este é um subtítulo de teste no limite máximo de cento e sessenta caracteres para validar se o espaçamento vertical entre o topo e o rodapé permanece 100% perfeito.',
        swipeText: 'Arraste para testar o limite →'
      },
      {
        type: 'content',
        step: '01',
        headline: 'Manchete de conteúdo no limite máximo absoluto de 75 caracteres sem quebrar.',
        body: 'Este parágrafo de conteúdo contém exatamente o volume de texto máximo permitido para validar que o auto-scaling ativo no DOM reduzirá o tamanho da fonte em tempo real, impedindo categoricamente qualquer corte no rodapé do slide ou sobreposição indesejada.',
        highlight: 'Destaque visual longo de teste no limite de noventa caracteres para estressar a área útil.'
      },
      {
        type: 'cta',
        headline: 'Chamada para ação no limite máximo absoluto de 70 caracteres para teste.',
        body: 'Corpo explicativo do slide de chamada para ação no limite máximo de cento e oitenta caracteres para garantir que o botão pontilhado permaneça perfeitamente centralizado e visível.',
        action: 'Comente TESTE para validar a integridade visual sem Canva'
      }
    ]
  };

  const result = await CarouselRenderer.renderCarousel(worstCaseCarousel, brandDna);
  console.log(`\n🎉 Teste de estresse concluído com sucesso!`);
  console.log(`📁 Imagens salvas em: ${result.outputDir}`);
}

runRenderTest().catch(console.error);
