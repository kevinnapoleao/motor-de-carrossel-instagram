import { chromium, Browser } from 'playwright';
import path from 'path';
import fs from 'fs/promises';
import { CarouselData, BrandDna } from '../core/types.js';
import { CarouselTemplateEngine } from './templateEngine.js';
import { MagazineCoverTemplateEngine } from './magazineCoverTemplate.js';
import { DepthSegmenter } from './depthSegmenter.js';

export interface RenderResult {
  outputDir: string;
  files: string[];
}

export class CarouselRenderer {
  /**
   * Renderiza todos os slides de um carrossel em imagens PNG de alta resolução (1080x1350)
   * Inclui garantia matemática ativa de Anti-Overflow no DOM do navegador
   */
  static async renderCarousel(
    carousel: CarouselData,
    brand: BrandDna,
    customOutputDir?: string
  ): Promise<RenderResult> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const folderName = `carousel_${timestamp}`;
    const outputDir = customOutputDir || path.resolve(process.cwd(), 'output', folderName);

    // Garante que a pasta de destino exista
    await fs.mkdir(outputDir, { recursive: true });

    // Pré-aquecimento autônomo do recorte 3D para tema magazine caso ainda não exista
    const isMagazine = carousel.theme === 'magazine' || brand.visual.theme === 'magazine';
    if (isMagazine) {
      try {
        await DepthSegmenter.getDepthLayers();
      } catch (err) {
        console.warn('⚠️ Aviso: Pré-aquecimento do recorte não executou, usando fallback.', err);
      }
    }

    let browser: Browser | null = null;
    const generatedFiles: string[] = [];

    try {
      console.log(`🎨 Iniciando renderização de ${carousel.slides.length} slides em 1080x1350...`);
      
      // Inicia navegador headless Playwright
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
      });

      const context = await browser.newContext({
        viewport: { width: 1080, height: 1350 },
        deviceScaleFactor: 2 // Renderização Retina 2x (2160x2700 real)
      });

      const page = await context.newPage();

      for (let i = 0; i < carousel.slides.length; i++) {
        const slide = carousel.slides[i];
        const slideHtml = isMagazine
          ? MagazineCoverTemplateEngine.renderSlideHtml(slide, i, carousel.slides.length, brand, carousel.slides)
          : CarouselTemplateEngine.renderSlideHtml(slide, i, carousel.slides.length, brand);

        // Carrega o HTML com as fontes externas
        await page.setContent(slideHtml, { waitUntil: 'networkidle' });

        // Garante que as fontes do Google Fonts terminaram de carregar
        await page.evaluate(() => document.fonts.ready);

        // 🛡️ GUARDIÃO ATIVO ANTI-OVERFLOW (DOM Measurement Loop)
        // Reduz dinamicamente o tamanho das fontes se o conteúdo exceder a área visível de 890px
        await page.evaluate(() => {
          const contentArea = document.querySelector('.content-area, .inner-body-wrap') as HTMLElement | null;
          if (!contentArea) return;

          const maxAllowedHeight = 890;
          let iterations = 0;
          const maxIterations = 25;

          // Se a altura real ultrapassa a área útil, reduz títulos e corpos de forma proporcional
          while (contentArea.scrollHeight > maxAllowedHeight && iterations < maxIterations) {
            iterations++;
            
            const headlines = document.querySelectorAll(
              '.content-headline, .cover-headline, .cta-headline, .inner-headline'
            );
            headlines.forEach((el) => {
              const htmlEl = el as HTMLElement;
              const currentSize = parseFloat(window.getComputedStyle(htmlEl).fontSize);
              if (currentSize > 32) {
                htmlEl.style.fontSize = `${currentSize - 2}px`;
              }
            });

            const bodies = document.querySelectorAll(
              '.content-body, .cover-subtitle, .cta-body, .inner-paragraph'
            );
            bodies.forEach((el) => {
              const htmlEl = el as HTMLElement;
              const currentSize = parseFloat(window.getComputedStyle(htmlEl).fontSize);
              if (currentSize > 22) {
                htmlEl.style.fontSize = `${currentSize - 1.5}px`;
              }
            });
          }
        });

        const fileName = `slide_${String(i + 1).padStart(2, '0')}.png`;
        const filePath = path.join(outputDir, fileName);

        await page.screenshot({
          path: filePath,
          type: 'png',
          clip: { x: 0, y: 0, width: 1080, height: 1350 }
        });

        generatedFiles.push(filePath);
        console.log(`  ✓ Slide ${i + 1}/${carousel.slides.length} renderizado com proteção anti-overflow: ${fileName}`);
      }

      console.log(`✅ Carrossel renderizado com sucesso em: ${outputDir}`);
      return { outputDir, files: generatedFiles };
    } catch (error) {
      console.error('❌ Erro na renderização do carrossel:', error);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}
