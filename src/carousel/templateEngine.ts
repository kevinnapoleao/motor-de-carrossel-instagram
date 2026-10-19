import { CarouselSlide, BrandDna } from '../core/types.js';
import { MediaResolver } from './mediaResolver.js';

/**
 * Sanitiza strings para evitar quebra da árvore DOM por caracteres reservados
 */
function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export class CarouselTemplateEngine {
  /**
   * Gera o HTML completo de um slide individual (1080x1350) com auto-scaling e proteção de layout
   */
  static renderSlideHtml(slide: CarouselSlide, index: number, totalSlides: number, brand: BrandDna): string {
    const isCover = slide.type === 'cover';
    const isCta = slide.type === 'cta';

    const colors = brand.visual.colors;
    const creator = brand.creator;
    const resolvedAvatarUrl = MediaResolver.getUserAvatarDataUri(creator.avatarUrl);

    // Escapamento seguro de inputs
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
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap');

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      -webkit-font-smoothing: antialiased;
    }

    body {
      width: 1080px;
      height: 1350px;
      background: ${colors.background};
      color: ${colors.text};
      font-family: 'Inter', sans-serif;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 80px 75px;
      position: relative;
    }

    /* Glows decorativos */
    .bg-glow {
      position: absolute;
      top: -150px;
      right: -150px;
      width: 500px;
      height: 500px;
      background: radial-gradient(circle, ${colors.primary}33 0%, transparent 70%);
      filter: blur(80px);
      z-index: 1;
      pointer-events: none;
    }

    .bg-glow-bottom {
      position: absolute;
      bottom: -150px;
      left: -150px;
      width: 450px;
      height: 450px;
      background: radial-gradient(circle, ${colors.secondary}22 0%, transparent 70%);
      filter: blur(80px);
      z-index: 1;
      pointer-events: none;
    }

    /* Top Bar */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: relative;
      z-index: 2;
      height: 70px;
    }

    .creator-info {
      display: flex;
      align-items: center;
      gap: 18px;
    }

    .creator-avatar {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      border: 2px solid ${colors.primary};
      object-fit: cover;
      background: ${colors.card};
    }

    .creator-name {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-weight: 700;
      font-size: 26px;
      color: ${colors.text};
      letter-spacing: -0.5px;
    }

    .creator-handle {
      font-size: 20px;
      color: ${colors.textMuted};
      font-weight: 500;
    }

    .slide-counter {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 22px;
      font-weight: 700;
      color: ${colors.primary};
      background: ${colors.primary}18;
      border: 1px solid ${colors.primary}33;
      padding: 10px 22px;
      border-radius: 100px;
      letter-spacing: 1px;
    }

    /* Área Principal de Conteúdo (Delimitada rigidamente para não ultrapassar 880px) */
    .content-area {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 32px;
      position: relative;
      z-index: 2;
      flex: 1;
      max-height: 890px;
      margin: 30px 0;
    }

    /* Capa */
    .badge-tag {
      align-self: flex-start;
      display: inline-block;
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 20px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: ${colors.primary};
      background: ${colors.primary}15;
      border: 1.5px solid ${colors.primary}55;
      padding: 10px 24px;
      border-radius: 8px;
    }

    .cover-headline {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 66px;
      font-weight: 800;
      line-height: 1.15;
      letter-spacing: -1.5px;
      color: #FFFFFF;
      text-wrap: balance;
    }

    .cover-subtitle {
      font-size: 34px;
      line-height: 1.5;
      color: ${colors.textMuted};
      font-weight: 400;
      max-width: 900px;
    }

    /* Conteúdo */
    .step-indicator {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .step-number {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 28px;
      font-weight: 800;
      color: ${colors.primary};
      background: ${colors.card};
      border: 1px solid ${colors.border};
      padding: 6px 18px;
      border-radius: 10px;
    }

    .content-headline {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 60px;
      font-weight: 800;
      line-height: 1.2;
      letter-spacing: -1px;
      color: #FFFFFF;
    }

    .content-body {
      font-size: 36px;
      line-height: 1.6;
      color: ${colors.text};
      font-weight: 400;
    }

    .highlight-card {
      background: ${colors.card};
      border-left: 5px solid ${colors.primary};
      border-top: 1px solid ${colors.border};
      border-right: 1px solid ${colors.border};
      border-bottom: 1px solid ${colors.border};
      padding: 26px 30px;
      border-radius: 0 16px 16px 0;
      font-size: 28px;
      font-weight: 600;
      color: ${colors.primary};
      line-height: 1.4;
    }

    /* CTA */
    .cta-container {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 30px;
    }

    .cta-headline {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 64px;
      font-weight: 800;
      line-height: 1.15;
      color: #FFFFFF;
      text-wrap: balance;
    }

    .cta-body {
      font-size: 34px;
      line-height: 1.5;
      color: ${colors.textMuted};
      max-width: 820px;
    }

    .cta-action-box {
      background: linear-gradient(135deg, ${colors.primary}22, ${colors.secondary}22);
      border: 2px dashed ${colors.primary};
      padding: 26px 44px;
      border-radius: 20px;
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 30px;
      font-weight: 700;
      color: ${colors.text};
      margin-top: 10px;
    }

    /* Rodapé */
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid ${colors.border};
      padding-top: 32px;
      position: relative;
      z-index: 2;
      height: 70px;
    }

    .footer-left {
      font-size: 22px;
      color: ${colors.textMuted};
      font-weight: 500;
      letter-spacing: 0.5px;
    }

    .footer-action {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 24px;
      font-weight: 700;
      color: ${colors.primary};
      display: flex;
      align-items: center;
      gap: 12px;
    }
  </style>
</head>
<body>
  <div class="bg-glow"></div>
  <div class="bg-glow-bottom"></div>

  <!-- Header -->
  <div class="header">
    <div class="creator-info">
      <img src="${resolvedAvatarUrl}" class="creator-avatar" alt="${escapeHtml(creator.name)}" />
      <div>
        <div class="creator-name">${escapeHtml(creator.name)}</div>
        <div class="creator-handle">${escapeHtml(creator.handle)}</div>
      </div>
    </div>
    <div class="slide-counter">${String(index + 1).padStart(2, '0')} / ${String(totalSlides).padStart(2, '0')}</div>
  </div>

  <!-- Main Content -->
  <div class="content-area">
    ${
      isCover
        ? `
      <div class="badge-tag">${safeTag}</div>
      <h1 class="cover-headline dynamic-text">${safeHeadline}</h1>
      <p class="cover-subtitle dynamic-text">${safeSubtitle}</p>
    `
        : isCta
        ? `
      <div class="cta-container">
        <h1 class="cta-headline dynamic-text">${safeHeadline}</h1>
        <p class="cta-body dynamic-text">${safeBody}</p>
        <div class="cta-action-box">📌 ${safeAction}</div>
      </div>
    `
        : `
      <div class="step-indicator">
        <span class="step-number">${safeStep}</span>
      </div>
      <h2 class="content-headline dynamic-text">${safeHeadline}</h2>
      <p class="content-body dynamic-text">${safeBody}</p>
      ${safeHighlight ? `<div class="highlight-card dynamic-text">💡 ${safeHighlight}</div>` : ''}
    `
    }
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-left">${escapeHtml(creator.title)}</div>
    <div class="footer-action">
      ${isCover ? safeSwipeText : isCta ? 'Salvar post ↗' : 'Arraste →'}
    </div>
  </div>
</body>
</html>`;
  }
}
