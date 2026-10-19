import Database from 'better-sqlite3';
import path from 'path';
import { TrendingTopic } from './trendHunter.js';
import { BrandDna } from '../core/types.js';

export interface ScoredTopic {
  topic: TrendingTopic;
  affinityScore: number;
  editorialAngle: 'viral_hook' | 'deep_dive' | 'business_growth';
  suggestedHeadline: string;
  rationale: string;
}

export class TopicScorer {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath || path.resolve(process.cwd(), 'database.sqlite');
    this.db = new Database(resolvedPath);
  }

  scoreAndRankTopics(trends: TrendingTopic[], brand: BrandDna): ScoredTopic[] {
    let bestAccountTerms: string[] = [];
    let hasVerifiedMetrics = false;
    try {
      const rows = this.db.prepare(`
        SELECT j.topic, SUM(m.saves + (2 * m.shares)) AS weightedSignals
        FROM post_metrics m JOIN content_jobs j ON j.id = m.jobId
        WHERE m.verified = 1
        GROUP BY j.topic ORDER BY weightedSignals DESC LIMIT 20
      `).all() as Array<{ topic: string; weightedSignals: number }>;
      if (rows.length) {
        hasVerifiedMetrics = true;
        bestAccountTerms = [...new Set(rows.flatMap((row) => row.topic.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || []))];
      }
    } catch {
      // Schema antigo ou sem métricas verificadas: o radar não presume desempenho.
    }

    const scoredList = trends.map((trend) => {
      const trendText = `${trend.title} ${trend.summary}`.toLowerCase();
      const nicheWords = [...new Set((brand.niche.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || []))];
      const nicheMatches = nicheWords.filter((word) => trendText.includes(word)).length;
      const nicheScore = Math.min(100, nicheMatches * 24);
      const accountMatches = bestAccountTerms.filter((word) => trendText.includes(word)).length;
      const accountScore = hasVerifiedMetrics ? Math.min(100, accountMatches * 30) : 50;
      const trendScore = Math.max(0, Math.min(100, trend.velocityScore));
      let score = trendScore * 0.4 + nicheScore * 0.35 + accountScore * 0.25;

      let penalty = 0;
      for (const forbidden of brand.style.forbiddenWords) {
        if (trendText.includes(forbidden.toLowerCase())) penalty += 12;
      }
      score = Math.max(0, Math.min(100, Math.round(score - penalty)));

      const editorialAngle: ScoredTopic['editorialAngle'] = trend.velocityScore >= 75
        ? 'viral_hook'
        : trend.category === 'ia_agentes' || trend.category === 'automacao_dev' ? 'deep_dive' : 'business_growth';
      const rationale = hasVerifiedMetrics
        ? `Compatibilidade com o nicho e similaridade com temas que receberam salvamentos/compartilhamentos registrados.`
        : `Compatibilidade editorial com o nicho; ainda sem métricas verificadas da conta para calibrar preferências.`;
      return {
        topic: trend,
        affinityScore: score,
        editorialAngle,
        suggestedHeadline: `${trend.title}: O que muda na prática`,
        rationale
      };
    });
    return scoredList.sort((a, b) => b.affinityScore - a.affinityScore);
  }
}
