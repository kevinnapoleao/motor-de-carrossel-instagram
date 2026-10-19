import Database from 'better-sqlite3';
import path from 'path';

export interface PostPerformanceMetric {
  id: string;
  jobId: string;
  platform: string;
  views: number;
  likes: number;
  shares: number;
  saves: number;
  comments: number;
  retentionRatePct: number;
  recordedAt: string;
}

export interface WeeklyNewsletterDraft {
  id: string;
  weekRange: string;
  subject: string;
  topPerformingTopic: string;
  newsletterMarkdown: string;
  generatedAt: string;
}

export class AnalyticsAndFeedbackEngine {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const finalPath = dbPath || path.resolve(process.cwd(), 'database.sqlite');
    this.db = new Database(finalPath);
    this.initTables();
  }

  private initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS post_metrics (
        id TEXT PRIMARY KEY, jobId TEXT NOT NULL, platform TEXT NOT NULL,
        views INTEGER DEFAULT 0, likes INTEGER DEFAULT 0, shares INTEGER DEFAULT 0,
        saves INTEGER DEFAULT 0, comments INTEGER DEFAULT 0, retentionRatePct REAL DEFAULT 0.0,
        recordedAt TEXT NOT NULL, verified INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS weekly_newsletters (
        id TEXT PRIMARY KEY, weekRange TEXT NOT NULL, subject TEXT NOT NULL,
        topPerformingTopic TEXT NOT NULL, newsletterMarkdown TEXT NOT NULL, generatedAt TEXT NOT NULL
      );
    `);
    // Existing rows have unknown provenance, so they remain preserved but are excluded from reporting.
    const columns = this.db.pragma('table_info(post_metrics)') as Array<{ name: string }>;
    if (!columns.some((column) => column.name === 'verified')) {
      this.db.exec('ALTER TABLE post_metrics ADD COLUMN verified INTEGER NOT NULL DEFAULT 0');
    }
  }

  public recordMetrics(metric: Omit<PostPerformanceMetric, 'recordedAt'>): PostPerformanceMetric {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO post_metrics (id, jobId, platform, views, likes, shares, saves, comments, retentionRatePct, recordedAt, verified)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(metric.id, metric.jobId, metric.platform, metric.views, metric.likes, metric.shares, metric.saves, metric.comments, metric.retentionRatePct, now);
    return { ...metric, recordedAt: now };
  }

  public getWeeklyLeaderboard(): { bestTopic: string; totalViews: number; totalSaves: number; avgRetention: number } {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const result = this.db.prepare(`
      SELECT j.topic, SUM(m.views) AS totalViews, SUM(m.saves) AS totalSaves,
        AVG(m.retentionRatePct) AS avgRetention
      FROM post_metrics m JOIN content_jobs j ON m.jobId = j.id
      WHERE m.verified = 1 AND m.recordedAt >= ?
      GROUP BY j.topic ORDER BY totalViews DESC, totalSaves DESC LIMIT 1
    `).get(since) as any;
    if (!result) return { bestTopic: 'Ainda sem dados medidos nesta semana', totalViews: 0, totalSaves: 0, avgRetention: 0 };
    return { bestTopic: result.topic, totalViews: Number(result.totalViews || 0), totalSaves: Number(result.totalSaves || 0), avgRetention: Math.round((Number(result.avgRetention) || 0) * 10) / 10 };
  }

  public getMetricsSummary() {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const totals = this.db.prepare(`
      SELECT SUM(CASE WHEN verified = 1 THEN 1 ELSE 0 END) AS metricsCount,
        SUM(CASE WHEN verified = 1 AND recordedAt >= ? THEN 1 ELSE 0 END) AS weeklyMetricsCount,
        SUM(CASE WHEN verified = 0 THEN 1 ELSE 0 END) AS unverifiedMetricsCount,
        COALESCE(SUM(CASE WHEN verified = 1 THEN views ELSE 0 END), 0) AS views,
        COALESCE(SUM(CASE WHEN verified = 1 THEN likes ELSE 0 END), 0) AS likes,
        COALESCE(SUM(CASE WHEN verified = 1 THEN shares ELSE 0 END), 0) AS shares,
        COALESCE(SUM(CASE WHEN verified = 1 THEN saves ELSE 0 END), 0) AS saves,
        COALESCE(SUM(CASE WHEN verified = 1 THEN comments ELSE 0 END), 0) AS comments,
        COALESCE(AVG(CASE WHEN verified = 1 THEN retentionRatePct END), 0) AS avgRetention
      FROM post_metrics
    `).get(since) as any;
    const byPlatform = this.db.prepare(`
      SELECT platform, COUNT(*) AS posts, SUM(views) AS views, SUM(saves) AS saves,
        SUM(shares) AS shares, AVG(retentionRatePct) AS avgRetention
      FROM post_metrics WHERE verified = 1 GROUP BY platform ORDER BY views DESC
    `).all();
    return {
      metricsCount: Number(totals.metricsCount || 0), weeklyMetricsCount: Number(totals.weeklyMetricsCount || 0),
      unverifiedMetricsCount: Number(totals.unverifiedMetricsCount || 0), views: Number(totals.views || 0),
      likes: Number(totals.likes || 0), shares: Number(totals.shares || 0), saves: Number(totals.saves || 0),
      comments: Number(totals.comments || 0), avgRetention: Math.round((Number(totals.avgRetention) || 0) * 10) / 10, byPlatform
    };
  }

  public generateWeeklyNewsletter(creatorName: string): WeeklyNewsletterDraft {
    const leaderboard = this.getWeeklyLeaderboard();
    const id = `newsletter_${Date.now()}`;
    const now = new Date();
    const weekRange = `Últimos 7 dias · ${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')} a ${now.toLocaleDateString('pt-BR')}`;
    const subject = `O que mais ressoou esta semana: ${leaderboard.bestTopic}`;
    const newsletterMarkdown = `# Insights da Semana com ${creatorName}\n*${weekRange}*\n\nOlá! Esta edição resume as métricas reais que você registrou para os seus conteúdos.\n\n## Conteúdo com mais visualizações na semana\n**Tema:** ${leaderboard.bestTopic}\n\n- Visualizações registradas: **${leaderboard.totalViews.toLocaleString('pt-BR')}**\n- Salvamentos registrados: **${leaderboard.totalSaves.toLocaleString('pt-BR')}**\n- Retenção média informada: **${leaderboard.avgRetention}%**\n\n## Próximos testes\n1. Compare os salvamentos e compartilhamentos com as visualizações.\n2. Use retenção e comentários como contexto, sem extrapolar além dos dados medidos.\n3. Teste uma nova variação do tema campeão e compare os resultados na próxima semana.\n\n---\n\n*Rascunho local gerado a partir dos dados informados. Revise antes de enviar.*\n`;
    this.db.prepare(`
      INSERT INTO weekly_newsletters (id, weekRange, subject, topPerformingTopic, newsletterMarkdown, generatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, weekRange, subject, leaderboard.bestTopic, newsletterMarkdown, now.toISOString());
    return { id, weekRange, subject, topPerformingTopic: leaderboard.bestTopic, newsletterMarkdown, generatedAt: now.toISOString() };
  }

  public close() {
    this.db.close();
  }
}
