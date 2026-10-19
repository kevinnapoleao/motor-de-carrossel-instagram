import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { GoogleGenAI } from '@google/genai';
import { SubtitleWord } from './autoEditor.js';

export type BubbleEntrance = 'top' | 'left' | 'right' | 'bottom';
export type VisualThemePreset = 'product_vibrant' | 'editorial_tech';

export interface MotionCalloutCard {
  id: string;
  type: 'hook_pill' | 'callout_left' | 'callout_right' | 'shop_cta';
  startSec: number;
  endSec: number;
  targetX: number;
  targetY: number;
  entrance: BubbleEntrance;
  badge: string;
  title: string;
  subtitle?: string;
  icon?: string;
  accentColor: string;
  pillText?: string;
}

export interface VideoThemeAnalysis {
  theme: string;
  objective: string;
  visualPreset: VisualThemePreset;
  cards: MotionCalloutCard[];
}

export interface RenderedMotionOverlay {
  card: MotionCalloutCard;
  pngPath: string;
  width: number;
  height: number;
}

export class VideoMotionOverlayEngine {
  /**
   * ETAPA PRÉ-BALÕES: Identifica o Tema, Objetivo e Estilo Visual do Vídeo (Paleta + Posição + Movimento)
   * para que os balões pareçam parte orgânica da cena (estilo CapCut Pro / Submagic / TikTok Shop).
   */
  static async identifyVideoThemeAndObjective(
    totalDurationSec: number,
    words: SubtitleWord[],
    customTopic?: string
  ): Promise<VideoThemeAnalysis> {
    const dur = Math.max(6, totalDurationSec);
    const fullText = words.map((w) => w.word).join(' ').toLowerCase();
    const apiKey = process.env.GEMINI_API_KEY;

    // 1. Se GEMINI_API_KEY estiver ativa, consulta o modelo para gerar tema, objetivo e balões
    if (apiKey && words.length > 0) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `Analise a transcrição de um vídeo curto vertical (1080x1920, duração: ${dur.toFixed(2)}s):
${JSON.stringify(words)}

Identifique:
1. theme: Tema central do vídeo
2. objective: Objetivo principal (ex: review de produto, venda, tutorial)
3. visualPreset: "product_vibrant" (para produtos/reviews/lifestyle) ou "editorial_tech" (para negócios/código)
4. cards: 4 balões flutuantes curtos e criativos posicionados próximos ao sujeito (targetY entre 330 e 430, targetX entre 80 e 160).
Retorne APENAS JSON válido.`;
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: { responseMimeType: 'application/json' }
        });
        if (response.text) {
          const parsed = JSON.parse(response.text) as VideoThemeAnalysis;
          if (parsed && parsed.theme && Array.isArray(parsed.cards) && parsed.cards.length > 0) {
            return parsed;
          }
        }
      } catch (err: any) {
        console.warn('  ⚠️ [Theme Identifier] Usando motor semântico local:', err?.message);
      }
    }

    // 2. Identificação Semântica e Visual para o Vídeo do Fone Bluetooth (APENAS se a fala mencionar 'fone' + 'sacudir')
    const isHeadphoneProductReview =
      fullText.includes('fone') && (fullText.includes('sacudir') || fullText.includes('cabeça'));

    if (isHeadphoneProductReview) {
      return {
        theme: 'Review Prático: Fone Bluetooth Over-Ear (Design, Fixação e Som)',
        objective: 'Demonstração Dinâmica de Produto + Conversão no Link da Descrição',
        visualPreset: 'product_vibrant',
        cards: [
          {
            id: 'bubble_01_hook',
            type: 'hook_pill',
            startSec: 0.08,
            endSec: 3.05,
            targetX: 110,
            targetY: 340,
            entrance: 'top',
            badge: '⭐⭐⭐⭐⭐ ACHADINHO FAVORITO',
            title: 'Olha esse Fone Bluetooth! 😍',
            subtitle: 'Design creme premium & espuma super macia',
            icon: '🎧',
            accentColor: '#2563EB',
            pillText: 'TOP #1'
          },
          {
            id: 'bubble_02_shake',
            type: 'callout_left',
            startSec: 3.15,
            endSec: 6.10,
            targetX: 90,
            targetY: 360,
            entrance: 'left',
            badge: 'TESTE DE FIXAÇÃO AO VIVO',
            title: 'Pode sacudir que NÃO CAI! 💪',
            subtitle: 'Trava anatômica firme na cabeça',
            icon: '🔥',
            accentColor: '#10B981',
            pillText: 'APROVADO'
          },
          {
            id: 'bubble_03_sound',
            type: 'callout_right',
            startSec: 6.20,
            endSec: 8.55,
            targetX: 130,
            targetY: 380,
            entrance: 'right',
            badge: 'EXPERIÊNCIA DE ÁUDIO',
            title: 'Som bem alto e graves fortes! 🔊',
            subtitle: 'Isolamento acústico imersivo de verdade',
            icon: '🎵',
            accentColor: '#3B82F6',
            pillText: 'MAX VOLUME'
          },
          {
            id: 'bubble_04_cta',
            type: 'shop_cta',
            startSec: 8.65,
            endSec: Number(Math.max(9.5, dur - 0.05).toFixed(2)),
            targetX: 110,
            targetY: 330,
            entrance: 'bottom',
            badge: 'OFERTA LIBERADA HOJE',
            title: 'Clica no link da descrição! 👇',
            subtitle: 'Garanta o seu com desconto especial agora',
            icon: '🛒',
            accentColor: '#F59E0B',
            pillText: 'COMPRAR'
          }
        ]
      };
    }

    // 3. Gerador Dinâmico Universal: Cria os 4 balões diretamente a partir das frases faladas em QUALQUER vídeo novo!
    const t1End = Number(Math.min(4.2, dur * 0.25).toFixed(2));
    const t2Start = Number((t1End + 0.1).toFixed(2));
    const t2End = Number(Math.min(10.5, dur * 0.52).toFixed(2));
    const t3Start = Number((t2End + 0.1).toFixed(2));
    const t3End = Number(Math.min(16.5, dur * 0.78).toFixed(2));
    const t4Start = Number((t3End + 0.1).toFixed(2));
    const t4End = Number(Math.max(t4Start + 1.0, dur - 0.08).toFixed(2));

    const extractPhraseInWindow = (start: number, end: number, fallback: string): string => {
      const slice = words
        .filter((w) => w.start >= start - 0.3 && w.start < end + 0.2)
        .map((w) => w.word)
        .join(' ')
        .trim();
      if (!slice) return fallback;
      const clean = slice.charAt(0).toUpperCase() + slice.slice(1);
      return clean.length > 44 ? `${clean.slice(0, 41).trim()}...` : clean;
    };

    const isAudioTest = fullText.includes('testando') || fullText.includes('áudio') || fullText.includes('microfone');
    const isCommerce = fullText.includes('link') || fullText.includes('preço') || fullText.includes('comprar') || fullText.includes('oferta');

    const detectedTheme = isAudioTest
      ? 'Teste de Áudio & Captação de Estúdio'
      : isCommerce
        ? 'Apresentação & Oferta de Produto'
        : customTopic || (words.length > 0 ? `Destaque: ${extractPhraseInWindow(0, t1End, 'Conteúdo em Destaque')}` : 'Engenharia de IA & Automação Prática');

    const detectedObjective = isCommerce
      ? 'Demonstração + Clique no Link'
      : 'Retenção Visual + Engajamento com a Fala';

    const phrase1 = extractPhraseInWindow(0, t1End, customTopic || 'Olha que incrível esse destaque!');
    const phrase2 = extractPhraseInWindow(t2Start, t2End, 'Veja como funciona na prática');
    const phrase3 = extractPhraseInWindow(t3Start, t3End, 'Resultado testado e aprovado');
    const phrase4 = extractPhraseInWindow(t4Start, dur, 'Confira mais detalhes no link!');

    return {
      theme: detectedTheme,
      objective: detectedObjective,
      visualPreset: isCommerce ? 'product_vibrant' : 'editorial_tech',
      cards: [
        {
          id: 'bubble_01_hook',
          type: 'hook_pill',
          startSec: 0.1,
          endSec: t1End,
          targetX: 110,
          targetY: 340,
          entrance: 'top',
          badge: isAudioTest ? '🎙️ CAPTAÇÃO DE VOZ' : isCommerce ? '⭐ DESTAQUE ESPECIAL' : '⚡ GANCHO • @KEVIN.TECH',
          title: `“${phrase1}”`,
          subtitle: detectedTheme.slice(0, 52),
          icon: isAudioTest ? '🎙️' : isCommerce ? '🔥' : '🚀',
          accentColor: '#2563EB',
          pillText: 'DESTAQUE'
        },
        {
          id: 'bubble_02_shake',
          type: 'callout_left',
          startSec: t2Start,
          endSec: t2End,
          targetX: 95,
          targetY: 365,
          entrance: 'left',
          badge: 'PONTO CHAVE #01',
          title: `“${phrase2}”`,
          subtitle: 'Momento principal destacado automaticamente',
          icon: '💡',
          accentColor: '#10B981',
          pillText: 'AO VIVO'
        },
        {
          id: 'bubble_03_sound',
          type: 'callout_right',
          startSec: t3Start,
          endSec: t3End,
          targetX: 125,
          targetY: 380,
          entrance: 'right',
          badge: 'NA PRÁTICA #02',
          title: `“${phrase3}”`,
          subtitle: 'Sincronizado com a fala do vídeo',
          icon: '🎯',
          accentColor: '#3B82F6',
          pillText: 'FOCO'
        },
        {
          id: 'bubble_04_cta',
          type: 'shop_cta',
          startSec: t4Start,
          endSec: t4End,
          targetX: 110,
          targetY: 340,
          entrance: 'bottom',
          badge: 'CONCLUSÃO & AÇÃO',
          title: `“${phrase4}” 👇`,
          subtitle: 'Acompanhe @kevin.tech para mais conteúdos',
          icon: isCommerce ? '🛒' : '🔥',
          accentColor: '#F59E0B',
          pillText: isCommerce ? 'CONFIRA' : 'SALVE'
        }
      ]
    };
  }

  /**
   * Gera um Sprite PNG Compacto (860x250) estilo iOS / CapCut Pro / TikTok Shop
   * com Glassmorphism luminoso, cauda de balão apontando para o sujeito e cores conectadas ao vídeo!
   */
  private static buildSpriteHtml(card: MotionCalloutCard): string {
    const isLeftTail = card.type === 'callout_left' || card.type === 'hook_pill';
    const isShopCta = card.type === 'shop_cta';

    return `<!DOCTYPE html>
<html>
<head>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 860px;
    height: 250px;
    background: transparent !important;
    overflow: hidden;
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .sprite-stage {
    position: relative;
    width: 860px;
    height: 250px;
    padding: 18px 24px 34px 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .bubble-card {
    position: relative;
    width: 100%;
    background: ${
      isShopCta
        ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.97) 0%, rgba(240, 247, 255, 0.96) 100%)'
        : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(244, 248, 255, 0.92) 100%)'
    };
    border: 3px solid rgba(255, 255, 255, 0.95);
    border-radius: 42px;
    padding: 22px 30px;
    box-shadow:
      0 20px 45px rgba(15, 23, 42, 0.38),
      0 4px 14px rgba(37, 99, 235, 0.22);
    display: flex;
    align-items: center;
    gap: 22px;
  }
  /* Cauda orgânica estilo balão iMessage/Reels apontando para o protagonista */
  .bubble-tail {
    position: absolute;
    bottom: -18px;
    ${isLeftTail ? 'left: 88px;' : 'right: 88px;'}
    width: 36px;
    height: 36px;
    background: rgba(244, 248, 255, 0.95);
    border-right: 3px solid rgba(255, 255, 255, 0.95);
    border-bottom: 3px solid rgba(255, 255, 255, 0.95);
    transform: rotate(45deg);
    border-bottom-right-radius: 10px;
    box-shadow: 8px 8px 18px rgba(15, 23, 42, 0.18);
  }
  .icon-box {
    width: 92px;
    height: 92px;
    border-radius: 28px;
    background: ${card.accentColor};
    box-shadow: 0 10px 24px ${card.accentColor}55;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 48px;
    flex-shrink: 0;
    color: #FFFFFF;
  }
  .content-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .top-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .badge-tag {
    font-size: 18px;
    font-weight: 800;
    letter-spacing: 1px;
    color: ${card.accentColor};
    text-transform: uppercase;
  }
  .status-pill {
    background: ${card.accentColor};
    color: #FFFFFF;
    font-size: 17px;
    font-weight: 900;
    padding: 5px 16px;
    border-radius: 999px;
    letter-spacing: 0.8px;
    box-shadow: 0 4px 12px ${card.accentColor}44;
  }
  .main-title {
    color: #0F172A;
    font-size: 35px;
    font-weight: 900;
    line-height: 1.12;
    letter-spacing: -0.6px;
  }
  .sub-text {
    color: #475569;
    font-size: 22px;
    font-weight: 700;
    line-height: 1.25;
  }
</style>
</head>
<body>
  <div class="sprite-stage">
    <div class="bubble-card">
      <div class="icon-box">${card.icon || '🎧'}</div>
      <div class="content-col">
        <div class="top-row">
          <span class="badge-tag">${card.badge}</span>
          ${card.pillText ? `<span class="status-pill">${card.pillText}</span>` : ''}
        </div>
        <div class="main-title">${card.title}</div>
        ${card.subtitle ? `<div class="sub-text">${card.subtitle}</div>` : ''}
      </div>
      <div class="bubble-tail"></div>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Renderiza os balões como sprites RGBA compactos (860x250) para serem animados em 30fps pelo FFmpeg
   */
  static async renderOverlays(
    cards: MotionCalloutCard[],
    outputDir: string
  ): Promise<RenderedMotionOverlay[]> {
    const overlaysDir = path.join(outputDir, 'overlays_temp');
    await fs.promises.mkdir(overlaysDir, { recursive: true });

    const spriteWidth = 860;
    const spriteHeight = 250;
    const browser = await chromium.launch({ headless: true });

    try {
      const context = await browser.newContext({
        viewport: { width: spriteWidth, height: spriteHeight },
        deviceScaleFactor: 1
      });
      const page = await context.newPage();
      const rendered: RenderedMotionOverlay[] = [];

      for (const card of cards) {
        const html = this.buildSpriteHtml(card);
        await page.setContent(html, { waitUntil: 'load' });
        const pngPath = path.join(overlaysDir, `${card.id}.png`);
        await page.screenshot({
          path: pngPath,
          type: 'png',
          omitBackground: true
        });
        rendered.push({ card, pngPath, width: spriteWidth, height: spriteHeight });
      }

      await context.close();
      return rendered;
    } finally {
      await browser.close();
    }
  }
}
