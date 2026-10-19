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

export class MagazineTemplateEngine {
  static renderSlideHtml(slide: CarouselSlide, index: number, totalSlides: number, brand: BrandDna): string {
    const isCover = slide.type === 'cover';
    const isCta = slide.type === 'cta';

    const creator = brand.creator;
    const resolvedAvatarUrl = MediaResolver.getUserAvatarDataUri(creator.avatarUrl);

    const safeHeadline = escapeHtml(slide.headline);
    const safeTag = isCover ? escapeHtml(slide.tag) : '';
    const safeSubtitle = isCover ? escapeHtml(slide.subtitle) : '';
    const safeSwipeText = isCover ? escapeHtml(slide.swipeText) : '';
    const safeBody = 'body' in slide ? escapeHtml(slide.body) : '';
    const safeHighlight = 'highlight' in slide && slide.highlight ? escapeHtml(slide.highlight) : '';
    const safeAction = isCta ? escapeHtml(slide.action) : '';
    const safeStep = 'step' in slide ? escapeHtml(slide.step) : '';

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800;900&family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,400;1,600&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap');

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      -webkit-font-smoothing: antialiased;
    }

    body {
      width: 1080px;
      height: 1350px;
      background: #090B0E;
      color: #F8FAFC;
      font-family: 'Plus Jakarta Sans', sans-serif;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 70px 75px;
      position: relative;
    }

    /* Moldura Editorial Editorial Grid & Linhas Finas */
    .magazine-border {
      position: absolute;
      top: 30px;
      left: 30px;
      right: 30px;
      bottom: 30px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      pointer-events: none;
      z-index: 1;
    }

    .editorial-watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-family: 'Cinzel', serif;
      font-size: 260px;
      font-weight: 900;
      color: rgba(255, 255, 255, 0.015);
      letter-spacing: 12px;
      pointer-events: none;
      z-index: 1;
      white-space: nowrap;
    }

    /* Topo Magazine Style */
    .magazine-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #FFFFFF;
      padding-bottom: 24px;
      position: relative;
      z-index: 2;
    }

    .masthead-left {
      display: flex;
      align-items: center;
      gap: 20px;
    }

    .creator-portrait {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid #38BDF8;
      box-shadow: 0 0 25px rgba(56, 189, 248, 0.35);
    }

    .masthead-titles {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .masthead-brand {
      font-family: 'Cinzel', serif;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: 3px;
      color: #FFFFFF;
      text-transform: uppercase;
    }

    .masthead-issue {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 14px;
      letter-spacing: 1.5px;
      color: #94A3B8;
      text-transform: uppercase;
    }

    .masthead-page-num {
      font-family: 'Cinzel', serif;
      font-size: 26px;
      font-weight: 700;
      color: #FFFFFF;
      letter-spacing: 2px;
    }

    /* Área Central - Diagramação Editorial */
    .content-area {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 32px;
      position: relative;
      z-index: 2;
      flex: 1;
      max-height: 900px;
      margin: 40px 0;
    }

    /* ESTILO MAGAZINE - CAPA */
    .mag-category {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 4px;
      text-transform: uppercase;
      color: #38BDF8;
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .mag-category::before {
      content: '';
      display: inline-block;
      width: 32px;
      height: 2px;
      background: #38BDF8;
    }

    .mag-headline {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 68px;
      font-weight: 800;
      line-height: 1.12;
      letter-spacing: -1px;
      color: #FFFFFF;
      text-wrap: balance;
    }

    .mag-headline em {
      font-style: italic;
      color: #38BDF8;
      font-weight: 400;
    }

    .mag-subtitle {
      font-size: 32px;
      font-weight: 400;
      line-height: 1.55;
      color: #CBD5E1;
      border-left: 2px solid rgba(255, 255, 255, 0.2);
      padding-left: 28px;
      max-width: 860px;
    }

    /* ESTILO MAGAZINE - CONTEÚDO */
    .mag-step-tag {
      font-family: 'Cinzel', serif;
      font-size: 40px;
      font-weight: 900;
      color: #38BDF8;
      letter-spacing: 1px;
    }

    .mag-content-headline {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 58px;
      font-weight: 700;
      line-height: 1.15;
      color: #FFFFFF;
    }

    .mag-body-text {
      font-size: 34px;
      line-height: 1.65;
      color: #E2E8F0;
      font-weight: 400;
    }

    .mag-pull-quote {
      background: rgba(255, 255, 255, 0.03);
      border-left: 4px solid #38BDF8;
      padding: 28px 36px;
      font-family: 'Playfair Display', Georgia, serif;
      font-style: italic;
      font-size: 32px;
      color: #F1F5F9;
      line-height: 1.45;
    }

    /* ESTILO MAGAZINE - CTA */
    .mag-cta-box {
      border: 1px solid rgba(56, 189, 248, 0.4);
      background: radial-gradient(circle at 50% 0%, rgba(56, 189, 248, 0.12) 0%, rgba(15, 23, 42, 0) 70%);
      padding: 48px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 28px;
    }

    .mag-cta-headline {
      font-family: 'Playfair Display', serif;
      font-size: 60px;
      font-weight: 800;
      color: #FFFFFF;
    }

    .mag-cta-body {
      font-size: 32px;
      line-height: 1.5;
      color: #94A3B8;
      max-width: 780px;
    }

    .mag-cta-button {
      background: #FFFFFF;
      color: #000000;
      font-family: 'Space Grotesk', sans-serif;
      font-size: 26px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      padding: 20px 42px;
      margin-top: 8px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    }

    /* Rodapé Magazine */
    .magazine-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid rgba(255, 255, 255, 0.15);
      padding-top: 24px;
      position: relative;
      z-index: 2;
    }

    .footer-col-left {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 16px;
      font-weight: 500;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #94A3B8;
    }

    .footer-col-right {
      font-family: 'Cinzel', serif;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 3px;
      color: #38BDF8;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="magazine-border"></div>
  <div class="editorial-watermark">EDITORIAL</div>

  <!-- Masthead Header -->
  <header class="magazine-header">
    <div class="masthead-left">
      <img src="${resolvedAvatarUrl}" class="creator-portrait" alt="${escapeHtml(creator.name)}" />
      <div class="masthead-titles">
        <div class="masthead-brand">${escapeHtml(creator.name)}</div>
        <div class="masthead-issue">${escapeHtml(creator.handle)} • SPECIAL ISSUE</div>
      </div>
    </div>
    <div class="masthead-page-num">${String(index + 1).padStart(2, '0')} / ${String(totalSlides).padStart(2, '0')}</div>
  </header>

  <!-- Content -->
  <main class="content-area">
    ${
      isCover
        ? `
      <div class="mag-category">${safeTag}</div>
      <h1 class="mag-headline">${safeHeadline}</h1>
      <p class="mag-subtitle">${safeSubtitle}</p>
    `
        : isCta
        ? `
      <div class="mag-cta-box">
        <h1 class="mag-cta-headline">${safeHeadline}</h1>
        <p class="mag-cta-body">${safeBody}</p>
        <div class="mag-cta-button">${safeAction}</div>
      </div>
    `
        : `
      <div class="mag-step-tag">PART // ${safeStep}</div>
      <h2 class="mag-content-headline">${safeHeadline}</h2>
      <p class="mag-body-text">${safeBody}</p>
      ${safeHighlight ? `<blockquote class="mag-pull-quote">"${safeHighlight}"</blockquote>` : ''}
    `
    }
  </main>

  <!-- Footer -->
  <footer class="magazine-footer">
    <div class="footer-col-left">CURATED INTELLIGENCE // ${escapeHtml(creator.title)}</div>
    <div class="footer-col-right">${isCover ? safeSwipeText : isCta ? 'SALVE PARA LER ↗' : 'CONTINUE →'}</div>
  </footer>
</body>
</html>`;
  }
}
