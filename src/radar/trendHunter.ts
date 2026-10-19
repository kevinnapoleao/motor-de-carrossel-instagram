export interface TrendingTopic {
  id: string;
  title: string;
  summary: string;
  category: 'ia_agentes' | 'automacao_dev' | 'produtividade' | 'negocios_tech';
  velocityScore: number; // 0 a 100 (velocidade de busca e engajamento)
  source: string;
  sourceUrl?: string;
  publishedAt: string;
  isLive?: boolean;
}

export class TrendHunter {
  /**
   * Monitora tendências reais de mercado no nicho de IA, Automação e Engenharia de Software.
   * Consulta API pública (Hacker News Algolia) em tempo real e combina com sinais do ecossistema.
   */
  static async scanNicheTrends(nicheKeywords: string[] = ['IA', 'Automação', 'Agentes']): Promise<TrendingTopic[]> {
    console.log(`📡 [TrendHunter] Escaneando radar de tendências ao vivo para: ${nicheKeywords.join(', ')}...`);

    const fallbackSignals: TrendingTopic[] = [
      {
        id: 'trend_01',
        title: 'Agentes Autônomos de Código Substituindo Pipelines Manuais de DevOps',
        summary: 'Engenheiros de software estão migrando de automações simples com webhooks para enxames de agentes autônomos com raciocínio profundo e auto-cura.',
        category: 'ia_agentes',
        velocityScore: 0,
        source: 'Sugestão editorial local — sem validação ao vivo',
        publishedAt: new Date().toISOString()
      },
      {
        id: 'trend_02',
        title: 'Estúdios de Mídia Programáticos: IA Generativa + Renderização Headless',
        summary: 'Criadores de elite estão combinando InstantID, IC-Light e Playwright para gerar capas de revista e vídeos curtos sem tocar em editores manuais.',
        category: 'automacao_dev',
        velocityScore: 0,
        source: 'Sugestão editorial local — sem validação ao vivo',
        publishedAt: new Date().toISOString()
      },
      {
        id: 'trend_03',
        title: 'Context-Engineering e Contratos Estritos com Zod para Agentes de Produção',
        summary: 'Modelos modernos exigem validação determinística de schemas e orquestração multi-agente para rodar sem alucinações.',
        category: 'ia_agentes',
        velocityScore: 0,
        source: 'Sugestão editorial local — sem validação ao vivo',
        publishedAt: new Date().toISOString()
      }
    ];

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(
        'https://hn.algolia.com/api/v1/search?query=AI+agents+automation&tags=story&hitsPerPage=3',
        { signal: controller.signal }
      );
      clearTimeout(timeout);

      if (res.ok) {
        const data = (await res.json()) as any;
        if (Array.isArray(data.hits)) {
          data.hits.forEach((hit: any, idx: number) => {
            if (hit.title) {
              fallbackSignals.push({
                id: `hn_live_${hit.objectID || idx}`,
                title: hit.title,
                summary: `Sinal público do Hacker News: ${hit.points || 0} pontos e ${hit.num_comments || 0} comentários.`,
                category: 'ia_agentes',
                velocityScore: Math.min(100, Math.round(35 + Math.log10((hit.points || 0) + (hit.num_comments || 0) + 1) * 14)),
                source: 'Hacker News · Algolia API',
                sourceUrl: hit.url || hit.story_url || undefined,
                publishedAt: hit.created_at || new Date().toISOString(),
                isLive: true
              });
            }
          });
          console.log(`🌐 [TrendHunter] Conectado à API ao vivo do Hacker News (${data.hits.length} sinais capturados).`);
        }
      }
    } catch {
      // Silencia erro de rede offline mantendo os sinais primários
    }

    console.log(`✅ [TrendHunter] ${fallbackSignals.filter((item) => item.isLive).length} tendências ao vivo no radar.`);
    return fallbackSignals;
  }
}
