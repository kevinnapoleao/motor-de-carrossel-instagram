import { CarouselSlide, BrandDna } from '../core/types.js';
import { MediaResolver } from './mediaResolver.js';

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatEditorialHeadline(safeHeadline: string): string {
  const words = safeHeadline.trim().split(/\s+/);
  if (words.length <= 3) return safeHeadline;
  const splitIndex = Math.max(1, words.length - 2);
  const firstPart = words.slice(0, splitIndex).join(' ');
  const goldPart = words.slice(splitIndex).join(' ');
  return `${firstPart} <span class="gold-italic-accent">${goldPart}</span>`;
}

export class MagazineCoverTemplateEngine {
  static renderSlideHtml(
    slide: CarouselSlide,
    index: number,
    totalSlides: number,
    brand: BrandDna,
    allSlides?: CarouselSlide[]
  ): string {
    const isCover = slide.type === 'cover';
    const isCta = slide.type === 'cta';

    const creator = brand.creator;
    const resolvedAvatarUrl = MediaResolver.getUserAvatarDataUri(creator.avatarUrl);
    const resolvedCutoutUrl = MediaResolver.getUserCutoutDataUri();

    const safeHeadline = escapeHtml(slide.headline);
    const safeTag = isCover ? escapeHtml(slide.tag) : '';
    const safeSubtitle = isCover ? escapeHtml(slide.subtitle) : '';
    const safeSwipeText = isCover ? escapeHtml(slide.swipeText) : '';
    const safeBody = 'body' in slide ? escapeHtml(slide.body) : '';
    const safeHighlight = 'highlight' in slide && slide.highlight ? escapeHtml(slide.highlight) : '';
    const safeAction = isCta ? escapeHtml(slide.action) : '';
    const safeStep = 'step' in slide ? escapeHtml(slide.step) : '';

    // Extrai chamadas dinâmicas das lâminas do carrossel para a capa não ficar engessada
    const slide2 = allSlides && allSlides[1] ? allSlides[1] : null;
    const slide3 = allSlides && allSlides[2] ? allSlides[2] : null;
    const slide4 = allSlides && allSlides[3] ? allSlides[3] : null;

    const callout1Title = slide2 ? escapeHtml(slide2.headline) : safeHeadline;
    const callout1Sub = safeSubtitle || 'Arquitetura de sistemas e escala real.';

    const callout2Title = slide3 ? escapeHtml(slide3.headline) : 'ENGENHARIA & ESCALA';
    const callout2Sub =
      slide3 && 'highlight' in slide3 && slide3.highlight
        ? escapeHtml(slide3.highlight)
        : 'Como construir operações autônomas de alto impacto.';

    const callout3Title = slide4 ? escapeHtml(slide4.headline) : 'ALTA PERFORMANCE';
    const callout3Sub =
      slide4 && 'highlight' in slide4 && slide4.highlight
        ? escapeHtml(slide4.highlight)
        : 'Estratégias práticas para dominar a distribuição digital.';

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,700;0,6..96,900;1,6..96,700&family=Cinzel:wght@600;700;800;900&family=Playfair+Display:ital,wght@0,600;0,700;0,800;0,900;1,400;1,700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      -webkit-font-smoothing: antialiased;
    }

    body {
      width: 1080px;
      height: 1350px;
      background: #080706;
      color: #FFFFFF;
      font-family: 'Bodoni Moda', 'Playfair Display', Georgia, serif;
      overflow: hidden;
      position: relative;
    }

    /* ========================================================
       CAMADA 1 (FUNDO): ENSAIO FOTOGRÁFICO DE ESTÚDIO COM BOKEH
       ======================================================== */
    .mag-studio-photo-bg {
      position: absolute;
      top: 52px;
      left: 0;
      width: 1080px;
      height: 1298px;
      object-fit: cover;
      object-position: center top;
      z-index: 1;
    }

    /* Vinheta cinematográfica quente para contraste perfeito da tipografia */
    .mag-studio-vignette {
      position: absolute;
      inset: 0;
      background: 
        linear-gradient(180deg, #080706 0%, #080706 4%, rgba(5, 4, 3, 0.55) 14%, rgba(5, 4, 3, 0.05) 28%, rgba(5, 4, 3, 0.12) 60%, rgba(5, 4, 3, 0.92) 100%),
        linear-gradient(90deg, rgba(5, 4, 3, 0.68) 0%, rgba(5, 4, 3, 0) 32%, rgba(5, 4, 3, 0) 68%, rgba(5, 4, 3, 0.68) 100%);
      z-index: 1;
    }

    /* ========================================================
       CAMADA 2 (MEIO): MASTHEAD DA REVISTA (HOMEM MODERNO / GQ)
       Posicionado atrás da cabeça do criador (efeito 3D real)
       ======================================================== */
    .mag-masthead {
      position: absolute;
      top: 32px;
      left: 0;
      width: 1080px;
      text-align: center;
      z-index: 2;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .mag-masthead-meta {
      width: 100%;
      padding: 0 58px;
      display: flex;
      justify-content: flex-end;
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 3.5px;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.88);
      margin-bottom: 2px;
    }

    .mag-title-homem {
      font-family: 'Bodoni Moda', serif;
      font-size: 154px;
      font-weight: 900;
      line-height: 0.84;
      letter-spacing: 10px;
      color: #FFFFFF;
      text-shadow: 0 8px 28px rgba(0, 0, 0, 0.85);
      text-transform: uppercase;
    }

    .mag-title-moderno {
      font-family: 'Bodoni Moda', serif;
      font-size: 112px;
      font-weight: 900;
      line-height: 0.86;
      letter-spacing: 19px;
      text-transform: uppercase;
      background: linear-gradient(180deg, #FFF6D6 0%, #E5C158 35%, #C59B27 75%, #8A6611 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      filter: drop-shadow(0 6px 22px rgba(0, 0, 0, 0.85));
      margin-top: 6px;
    }

    /* ========================================================
       CAMADA 3 (FRENTE): RECORTE 3D PIXEL-LOCKED 1:1
       Alinhamento sub-pixel idêntico à Camada 1, sobrepondo o título
       ======================================================== */
    .mag-cutout-container {
      position: absolute;
      top: 52px;
      left: 0;
      width: 1080px;
      height: 1298px;
      z-index: 3;
      pointer-events: none;
    }

    .mag-cutout-img {
      width: 1080px;
      height: 1298px;
      object-fit: cover;
      object-position: center top;
      filter: drop-shadow(0 -6px 18px rgba(0, 0, 0, 0.55));
    }

    /* ========================================================
       CAMADA 4 (OVERLAY): MANCHETES DINÂMICAS & CÓDIGO DE BARRAS
       ======================================================== */
    .mag-overlay-container {
      position: absolute;
      inset: 0;
      width: 1080px;
      height: 1350px;
      z-index: 4;
      pointer-events: none;
    }

    /* Coluna Esquerda de Matérias */
    .mag-stories-left {
      position: absolute;
      top: 520px;
      left: 55px;
      width: 345px;
      display: flex;
      flex-direction: column;
      gap: 34px;
      text-shadow: 0 4px 18px rgba(0, 0, 0, 0.95);
    }

    .mag-story-block {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .mag-tag-white {
      font-family: 'Bodoni Moda', serif;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: 1.2px;
      color: #FFFFFF;
      text-transform: uppercase;
      line-height: 1.18;
    }

    .mag-sub-muted {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 13px;
      font-weight: 600;
      color: #D4AF37;
      letter-spacing: 1.5px;
      text-transform: uppercase;
    }

    .mag-tag-gold {
      font-family: 'Bodoni Moda', serif;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: 1.2px;
      color: #E5C158;
      text-transform: uppercase;
      line-height: 1.2;
    }

    .mag-desc-white {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 15px;
      font-weight: 500;
      color: #E5E7EB;
      line-height: 1.42;
    }

    .mag-interview-kicker {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 2.5px;
      color: #FFFFFF;
      text-transform: uppercase;
    }

    .mag-interview-name {
      font-family: 'Bodoni Moda', serif;
      font-size: 56px;
      font-weight: 900;
      letter-spacing: 2px;
      line-height: 1.02;
      background: linear-gradient(180deg, #FFFFFF 15%, #E5C158 75%, #AA8022 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      text-transform: uppercase;
    }

    /* Coluna Direita de Matérias */
    .mag-stories-right {
      position: absolute;
      top: 710px;
      right: 55px;
      width: 335px;
      text-align: right;
      display: flex;
      flex-direction: column;
      gap: 34px;
      text-shadow: 0 4px 18px rgba(0, 0, 0, 0.95);
    }

    /* Rodapé com Código de Barras Real */
    .mag-bottom-footer {
      position: absolute;
      bottom: 45px;
      left: 55px;
      right: 55px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .barcode-box {
      background: #FFFFFF;
      padding: 6px 12px;
      border-radius: 2px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.75);
    }

    .barcode-meta {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 8px;
      font-weight: 800;
      color: #000000;
      letter-spacing: 1.5px;
      text-transform: uppercase;
    }

    .barcode-lines {
      width: 140px;
      height: 38px;
      background: repeating-linear-gradient(
        90deg,
        #000000 0px,
        #000000 3px,
        #FFFFFF 3px,
        #FFFFFF 5px,
        #000000 5px,
        #000000 8px,
        #FFFFFF 8px,
        #FFFFFF 10px,
        #000000 10px,
        #000000 14px,
        #FFFFFF 14px,
        #FFFFFF 16px
      );
    }

    .barcode-number {
      font-family: monospace;
      font-size: 11px;
      font-weight: 700;
      color: #000000;
      letter-spacing: 2px;
    }

    .mag-footer-swipe {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 2.5px;
      text-transform: uppercase;
      color: #F3F4F6;
      text-shadow: 0 3px 12px rgba(0, 0, 0, 0.95);
    }

    /* ========================================================
       SLIDES DE CONTEÚDO E CTA (SLIDES 2 A 5): DIAGRAMAÇÃO LUXO
       ======================================================== */
    .inner-slide-layout {
      width: 1080px;
      height: 1350px;
      background: radial-gradient(circle at 85% 18%, #1A1610 0%, #0B0B0E 55%, #060608 100%);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 70px 75px;
      position: relative;
      overflow: hidden;
    }

    .inner-watermark-number {
      position: absolute;
      right: 40px;
      bottom: 110px;
      font-family: 'Bodoni Moda', serif;
      font-size: 380px;
      font-weight: 900;
      line-height: 0.8;
      color: rgba(212, 175, 55, 0.045);
      pointer-events: none;
      z-index: 1;
    }

    .inner-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1.5px solid rgba(212, 175, 55, 0.55);
      padding-bottom: 22px;
      position: relative;
      z-index: 2;
    }

    .inner-brand-title {
      font-family: 'Cinzel', serif;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: 3.5px;
      color: #D4AF37;
      text-transform: uppercase;
    }

    .inner-page-count {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 19px;
      font-weight: 700;
      color: #FFFFFF;
      letter-spacing: 2px;
    }

    .inner-body-wrap {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 32px;
      flex: 1;
      max-height: 890px;
      margin: 30px 0;
      position: relative;
      z-index: 2;
    }

    .inner-step-callout {
      font-family: 'Cinzel', serif;
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 3.5px;
      color: #D4AF37;
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .inner-step-callout::before {
      content: '';
      display: inline-block;
      width: 36px;
      height: 2px;
      background: #D4AF37;
    }

    .inner-headline {
      font-family: 'Playfair Display', serif;
      font-size: 60px;
      font-weight: 800;
      line-height: 1.14;
      color: #FFFFFF;
    }

    .gold-italic-accent {
      font-style: italic;
      color: #E5C158;
    }

    .inner-paragraph {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 33px;
      line-height: 1.58;
      color: #D1D5DB;
    }

    .inner-quote-box {
      border-left: 4px solid #D4AF37;
      background: linear-gradient(90deg, rgba(212, 175, 55, 0.1) 0%, rgba(212, 175, 55, 0.02) 100%);
      padding: 28px 34px;
      font-family: 'Playfair Display', serif;
      font-style: italic;
      font-size: 30px;
      color: #F9FAFB;
      line-height: 1.45;
      border-radius: 0 8px 8px 0;
    }

    .inner-cta-container {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 32px;
    }

    .inner-cta-avatar {
      width: 130px;
      height: 130px;
      border-radius: 50%;
      object-fit: cover;
      object-position: center top;
      border: 3px solid #D4AF37;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);
    }

    .inner-cta-btn {
      background: linear-gradient(135deg, #E5C158 0%, #B38728 100%);
      color: #000000;
      font-family: 'Cinzel', serif;
      font-size: 24px;
      font-weight: 900;
      letter-spacing: 2px;
      padding: 24px 48px;
      border-radius: 4px;
      text-transform: uppercase;
      box-shadow: 0 12px 35px rgba(212, 175, 55, 0.35);
    }

    .inner-author-footer {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .inner-author-thumb {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      object-fit: cover;
      object-position: center top;
      border: 1.5px solid #D4AF37;
    }
  </style>
</head>
<body>
  ${
    isCover
      ? `
    <!-- CAMADA 1: ENSAIO FOTOGRÁFICO DE ESTÚDIO COM BOKEH QUENTE -->
    <img src="${resolvedAvatarUrl}" class="mag-studio-photo-bg" alt="Studio Background" />
    <div class="mag-studio-vignette"></div>

    <!-- CAMADA 2: MASTHEAD HOMEM MODERNO ATRÁS DA CABEÇA -->
    <div class="mag-masthead">
      <div class="mag-masthead-meta">OUTUBRO 2026 | EDIÇÃO ESPECIAL</div>
      <div class="mag-title-homem">HOMEM</div>
      <div class="mag-title-moderno">MODERNO</div>
    </div>

    <!-- CAMADA 3: RECORTE 3D PIXEL-LOCKED 1:1 (CABEÇA SOBREPÕE O TÍTULO) -->
    ${
      resolvedCutoutUrl
        ? `
    <div class="mag-cutout-container">
      <img src="${resolvedCutoutUrl}" class="mag-cutout-img" alt="${escapeHtml(creator.name)}" />
    </div>`
        : ''
    }

    <!-- CAMADA 4: OVERLAY EDITORIAL DINÂMICO (MANCHETES DO DIA E CÓDIGO DE BARRAS) -->
    <div class="mag-overlay-container">
      <!-- Coluna Esquerda -->
      <div class="mag-stories-left">
        <div class="mag-story-block">
          <div class="mag-tag-white">${safeTag || 'ESPECIAL IA & DEVOPS'}</div>
          <div class="mag-sub-muted">Shot on Sony A1 // 85mm f/1.4</div>
        </div>

        <div class="mag-story-block">
          <div class="mag-tag-gold">${callout1Title}</div>
          <div class="mag-desc-white">${callout1Sub}</div>
        </div>

        <div class="mag-story-block" style="margin-top: 8px;">
          <div class="mag-interview-kicker">ENTREVISTA EXCLUSIVA:</div>
          <div class="mag-interview-name">${escapeHtml(creator.name)}</div>
        </div>
      </div>

      <!-- Coluna Direita -->
      <div class="mag-stories-right">
        <div class="mag-story-block">
          <div class="mag-tag-gold">${callout2Title}</div>
          <div class="mag-desc-white">${callout2Sub}</div>
        </div>

        <div class="mag-story-block">
          <div class="mag-tag-gold">${callout3Title}</div>
          <div class="mag-desc-white">${callout3Sub}</div>
        </div>
      </div>

      <!-- Rodapé com Código de Barras Real -->
      <div class="mag-bottom-footer">
        <div class="barcode-box">
          <div class="barcode-meta">EDIÇÃO 52 // 2026</div>
          <div class="barcode-lines"></div>
          <div class="barcode-number">9 771131 005578</div>
        </div>
        <div class="mag-footer-swipe">${escapeHtml(creator.handle)} // ${safeSwipeText || 'ARRASTE PARA LER →'}</div>
      </div>
    </div>
  `
      : `
    <!-- SLIDES DE CONTEÚDO E CTA COM TIPOGRAFIA LUXURY -->
    <div class="inner-slide-layout">
      <div class="inner-watermark-number">${String(index + 1).padStart(2, '0')}</div>

      <header class="inner-header">
        <div class="inner-brand-title">HOMEM MODERNO // ${escapeHtml(creator.name)}</div>
        <div class="inner-page-count">${String(index + 1).padStart(2, '0')} / ${String(totalSlides).padStart(2, '0')}</div>
      </header>

      <main class="inner-body-wrap">
        ${
          isCta
            ? `
          <div class="inner-cta-container">
            <img src="${resolvedAvatarUrl}" class="inner-cta-avatar" alt="${escapeHtml(creator.name)}" />
            <h1 class="inner-headline" style="font-size: 62px;">${formatEditorialHeadline(safeHeadline)}</h1>
            <p class="inner-paragraph">${safeBody}</p>
            <div class="inner-cta-btn">📌 ${safeAction}</div>
          </div>
        `
            : `
          <div class="inner-step-callout">MATÉRIA // PARTE ${safeStep}</div>
          <h2 class="inner-headline">${formatEditorialHeadline(safeHeadline)}</h2>
          <p class="inner-paragraph">${safeBody}</p>
          ${safeHighlight ? `<blockquote class="inner-quote-box">“${safeHighlight}”</blockquote>` : ''}
        `
        }
      </main>

      <footer class="inner-header" style="border-bottom: none; border-top: 1px solid rgba(212, 175, 55, 0.25); padding-top: 22px;">
        <div class="inner-author-footer">
          <img src="${resolvedAvatarUrl}" class="inner-author-thumb" alt="${escapeHtml(creator.name)}" />
          <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 15px; font-weight: 600; color: #D1D5DB; text-transform: uppercase; letter-spacing: 1px;">${escapeHtml(creator.name)} • ${escapeHtml(creator.title)}</div>
        </div>
        <div style="font-family: 'Cinzel', serif; font-size: 16px; font-weight: 800; color: #D4AF37;">${isCta ? 'SALVE ESTE POST ↗' : 'CONTINUE →'}</div>
      </footer>
    </div>
  `
  }
</body>
</html>`;
  }
}
