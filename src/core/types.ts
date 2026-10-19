import { z } from 'zod';

// Schema para cada slide do Carrossel com limites rígidos para evitar overflow visual
export const CoverSlideSchema = z.object({
  type: z.literal('cover'),
  tag: z.string().max(30, 'Tag deve ter no máximo 30 caracteres'),
  headline: z.string().max(80, 'Headline da capa deve ter no máximo 80 caracteres'),
  subtitle: z.string().max(160, 'Subtítulo da capa deve ter no máximo 160 caracteres'),
  swipeText: z.string().default('Arraste para o lado →')
});

export const ContentSlideSchema = z.object({
  type: z.literal('content'),
  step: z.string().max(4), // Ex: "01", "02"
  headline: z.string().max(75, 'Headline deve ter no máximo 75 caracteres'),
  body: z.string().max(260, 'Corpo de texto deve ter no máximo 260 caracteres para não quebrar o layout'),
  highlight: z.string().max(90, 'Destaque deve ter no máximo 90 caracteres').optional()
});

export const CtaSlideSchema = z.object({
  type: z.literal('cta'),
  headline: z.string().max(70, 'Headline do CTA deve ter no máximo 70 caracteres'),
  body: z.string().max(180, 'Corpo do CTA deve ter no máximo 180 caracteres'),
  action: z.string().max(90, 'Ação principal deve ter no máximo 90 caracteres')
});

export const CarouselSlideSchema = z.discriminatedUnion('type', [
  CoverSlideSchema,
  ContentSlideSchema,
  CtaSlideSchema
]);

export const CarouselDataSchema = z.object({
  theme: z.string().default('dark_modern'),
  topic: z.string(),
  slides: z.array(CarouselSlideSchema).min(4).max(10)
});

// Schema de Roteiro de Reels com indicações de direção e ganchos
export const ReelsScriptSchema = z.object({
  hook: z.string().describe('Gancho de impacto para os primeiros 3 segundos do vídeo'),
  body: z.string().describe('Corpo do roteiro falado com marcações [ÊNFASE] ou [CORTE]'),
  visualNotes: z.string().describe('Instruções visuais para o editor (b-roll, zoom, texto na tela)'),
  cta: z.string().describe('Chamada para ação final de 5 segundos')
});

// Schema Completo de Multi-Formato
export const MultiFormatContentSchema = z.object({
  topic: z.string(),
  reels: ReelsScriptSchema,
  carousel: CarouselDataSchema,
  linkedin: z.string().describe('Post completo para o LinkedIn formatado com quebras e emojis cirúrgicos'),
  blog: z.object({
    title: z.string(),
    metaDescription: z.string(),
    markdown: z.string()
  }),
  newsletter: z.object({
    subject: z.string(),
    previewText: z.string(),
    bodyMarkdown: z.string()
  })
});

// Tipos TypeScript inferidos
export type CoverSlide = z.infer<typeof CoverSlideSchema>;
export type ContentSlide = z.infer<typeof ContentSlideSchema>;
export type CtaSlide = z.infer<typeof CtaSlideSchema>;
export type CarouselSlide = z.infer<typeof CarouselSlideSchema>;
export type CarouselData = z.infer<typeof CarouselDataSchema>;
export type ReelsScript = z.infer<typeof ReelsScriptSchema>;
export type MultiFormatContent = z.infer<typeof MultiFormatContentSchema>;

export interface BrandDna {
  creator: {
    name: string;
    handle: string;
    title: string;
    avatarUrl: string;
  };
  niche: string;
  style: {
    tone: string;
    pacing: string;
    rules: string[];
    forbiddenWords: string[];
  };
  visual: {
    dimensions: {
      width: number;
      height: number;
    };
    theme: string;
    colors: {
      background: string;
      card: string;
      primary: string;
      secondary: string;
      text: string;
      textMuted: string;
      accent: string;
      border: string;
    };
    typography: {
      titleFont: string;
      bodyFont: string;
    };
  };
}
