import Database from 'better-sqlite3';
import fs from 'node:fs/promises';
import path from 'node:path';
import { AnalyticsAndFeedbackEngine } from './analyticsEngine.js';

async function testAnalyticsAndNewsletter() {
  const testDir = path.resolve(process.cwd(), '.work', 'analytics-test');
  const dbPath = path.join(testDir, 'test.sqlite');
  await fs.mkdir(testDir, { recursive: true });
  const db = new Database(dbPath);
  db.exec('CREATE TABLE content_jobs (id TEXT PRIMARY KEY, topic TEXT NOT NULL)');
  db.prepare('INSERT INTO content_jobs (id, topic) VALUES (?, ?)').run('job_test', 'Pauta de teste isolada');
  db.close();

  const analytics = new AnalyticsAndFeedbackEngine(dbPath);
  try {
    analytics.recordMetrics({ id: 'metric_test_local', jobId: 'job_test', platform: 'instagram', views: 1200, likes: 90, shares: 18, saves: 44, comments: 9, retentionRatePct: 62 });
    const newsletter = analytics.generateWeeklyNewsletter('Teste local');
    console.log(`✓ Métricas isoladas: ${analytics.getMetricsSummary().metricsCount}`);
    console.log(`✓ Tema: ${newsletter.topPerformingTopic}`);
    console.log(`✓ Newsletter: ${newsletter.id}`);
  } finally {
    analytics.close();
    await fs.rm(testDir, { recursive: true, force: true });
  }
}

testAnalyticsAndNewsletter().catch((error) => { console.error(error); process.exitCode = 1; });
