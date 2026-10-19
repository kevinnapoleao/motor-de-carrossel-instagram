import 'dotenv/config';
import http from 'node:http';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { StateMachineService } from './core/stateMachine.js';
import { ContentLlmEngine } from './core/llm.js';
import { CarouselRenderer } from './carousel/renderer.js';
import { TrendHunter } from './radar/trendHunter.js';
import { TopicScorer } from './radar/topicScorer.js';
import { getBasePlatform, isSupportedIntegration, SocialDistributionEngine, SocialPlatform } from './distribution/socialEngine.js';
import type { PostizIntegration, ScheduleOptions } from './distribution/socialEngine.js';
import { AnalyticsAndFeedbackEngine } from './analytics/analyticsEngine.js';
import { VideoAutoEditor } from './video/autoEditor.js';
import { BrandDna } from './core/types.js';
import { MoneyPrinterEngine } from './moneyprinter/engine.js';

const root = process.cwd();
const port = Number(process.env.PORT || 3000);
const publicDir = path.resolve(root, 'public');
const outputDir = path.resolve(root, 'output');
const videoInputDir = path.resolve(root, 'inputs', 'raw_videos');
const state = new StateMachineService();
const analytics = new AnalyticsAndFeedbackEngine();
const scorer = new TopicScorer();
const moneyPrinter = new MoneyPrinterEngine();
const platformList: SocialPlatform[] = ['instagram', 'tiktok', 'youtube', 'threads', 'linkedin'];

const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.ass': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8'
};

function json(res: http.ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}

function inside(base: string, target: string) {
  const relative = path.relative(base, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

async function readBody(req: http.IncomingMessage, maxBytes = 1024 * 1024): Promise<any> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) throw Object.assign(new Error('O arquivo enviado ultrapassa o limite permitido.'), { statusCode: 413 });
    chunks.push(buffer);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {};
  try { return JSON.parse(text); } catch { throw Object.assign(new Error('Corpo JSON inválido.'), { statusCode: 400 }); }
}

function parseJob(job: any) {
  if (!job) return null;
  const parse = (value: unknown) => {
    if (typeof value !== 'string') return value ?? null;
    try { return JSON.parse(value); } catch { return value; }
  };
  return {
    ...job,
    status: job.status === 'PUBLISHED' ? 'LEGACY_UNVERIFIED' : job.status,
    reelsScript: parse(job.reelsScript), carouselData: parse(job.carouselData), blogPost: parse(job.blogPost), newsletter: parse(job.newsletter)
  };
}

function mediaUrl(filePath: string) {
  const rel = path.relative(root, filePath).split(path.sep).join('/');
  return `/media/${rel.split('/').map(encodeURIComponent).join('/')}`;
}

async function persistContent(jobId: string, topic: string) {
  const brand: BrandDna = JSON.parse(await fs.readFile(path.join(root, 'config', 'brand_dna.json'), 'utf8'));
  const examples = JSON.parse(await fs.readFile(path.join(root, 'config', 'examples.json'), 'utf8'));
  const content = await new ContentLlmEngine().generateContent({ topic, brandDna: brand, examples });
  const rendered = await CarouselRenderer.renderCarousel(content.carousel, brand);
  const report = `# Pacote de conteúdo — ${content.topic}\n\n**ID:** ${jobId}  \n**Status:** Aguardando sua aprovação  \n**Criado:** ${new Date().toLocaleString('pt-BR')}\n\n## Reels / TikTok / Shorts\n**Gancho:** ${content.reels.hook}\n\n${content.reels.body}\n\n**Direção visual:** ${content.reels.visualNotes}\n\n**CTA:** ${content.reels.cta}\n\n## Carrossel Instagram\n${content.carousel.slides.map((slide: any, i: number) => `- Slide ${i + 1}: ${slide.headline || slide.subtitle || slide.body}`).join('\n')}\n\n## LinkedIn\n${content.linkedin}\n\n## Artigo para o blog\n**${content.blog.title}**\n\n${content.blog.markdown}\n\n## Newsletter\n**Assunto:** ${content.newsletter.subject}\n\n${content.newsletter.bodyMarkdown}\n`;
  await fs.writeFile(path.join(rendered.outputDir, 'conteudo_completo.json'), JSON.stringify(content, null, 2), 'utf8');
  await fs.writeFile(path.join(rendered.outputDir, 'ROTEIROS_E_POSTS.md'), report, 'utf8');
  state.updateJobContent(jobId, {
    reelsScript: content.reels,
    carouselData: content.carousel,
    linkedinPost: content.linkedin,
    blogPost: content.blog,
    newsletter: content.newsletter,
    outputDir: rendered.outputDir
  });
  return { content, reportUrl: mediaUrl(path.join(rendered.outputDir, 'ROTEIROS_E_POSTS.md')), carousel: { outputDir: rendered.outputDir, slides: rendered.files.map((file) => mediaUrl(file)) } };
}

async function serveLocalFile(res: http.ServerResponse, base: string, rel: string) {
  const target = path.resolve(base, rel);
  if (!inside(base, target)) return false;
  try {
    const stat = await fs.stat(target);
    if (!stat.isFile()) return false;
    res.writeHead(200, { 'Content-Type': mime[path.extname(target).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    await new Promise<void>((resolve, reject) => {
      const stream = createReadStream(target);
      stream.on('error', reject); stream.on('end', resolve); stream.pipe(res);
    });
    return true;
  } catch { return false; }
}

function normalizePostizApiUrl(value: unknown): string {
  const raw = typeof value === 'string' && value.trim() ? value.trim() : SocialDistributionEngine.getApiUrl();
  let parsed: URL;
  try { parsed = new URL(raw); } catch { throw Object.assign(new Error('Informe uma URL completa da API Postiz.'), { statusCode: 400 }); }
  const localHost = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && localHost)) {
    throw Object.assign(new Error('Use HTTPS para Postiz remoto. HTTP só é aceito em localhost.'), { statusCode: 400 });
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash || !/\/(?:api\/)?public\/v1$/i.test(parsed.pathname.replace(/\/+$/, ''))) {
    throw Object.assign(new Error('A URL deve terminar em /public/v1 (Postiz Cloud) ou /api/public/v1 (self-hosted), sem usuário, senha ou parâmetros.'), { statusCode: 400 });
  }
  return parsed.toString().replace(/\/+$/, '');
}

async function saveLocalEnvValue(key: 'POSTIZ_API_URL' | 'POSTIZ_API_KEY', value: string) {
  const file = path.join(root, '.env');
  const current = await fs.readFile(file, 'utf8').catch(() => '');
  const lines = current ? current.split(/\r?\n/) : [];
  const prefix = new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=`);
  const nextLine = `${key}=${JSON.stringify(value)}`;
  const index = lines.findIndex((line) => prefix.test(line));
  if (index >= 0) lines[index] = nextLine;
  else lines.push(nextLine);
  const temporary = `${file}.${Date.now()}.tmp`;
  await fs.writeFile(temporary, `${lines.join('\n').replace(/\n+$/, '')}\n`, { encoding: 'utf8', mode: 0o600 });
  await fs.rename(temporary, file);
  process.env[key] = value;
}

async function handler(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  try {
    if (req.method === 'GET' && url.pathname === '/api/dashboard') {
      const brand = JSON.parse(await fs.readFile(path.join(root, 'config', 'brand_dna.json'), 'utf8')) as BrandDna;
      const jobs = state.listJobs(20).map(parseJob);
      const latest = jobs[0] || null;
      const carouselFiles = latest?.outputDir ? (await fs.readdir(latest.outputDir).catch(() => [])).filter((name: string) => /^slide_\d+\.png$/i.test(name)).sort() : [];
      const videoFiles = (await fs.readdir(path.join(outputDir, 'video_reels')).catch(() => [])).filter((name: string) => /^reels_final_.*\.mp4$/i.test(name)).sort().reverse();
      return json(res, 200, {
        creator: brand.creator, brand: { niche: brand.niche, style: brand.style, visual: brand.visual }, jobs, latest,
        slides: latest?.outputDir ? carouselFiles.map((file: string) => mediaUrl(path.join(latest.outputDir, file))) : [],
        video: videoFiles[0] ? mediaUrl(path.join(outputDir, 'video_reels', videoFiles[0])) : null,
        integrations: { gemini: Boolean(process.env.GEMINI_API_KEY), postiz: Boolean(process.env.POSTIZ_API_KEY), trends: 'hacker-news-public' },
        checkedAt: new Date().toISOString()
      });
    }
    if (req.method === 'GET' && url.pathname === '/api/postiz/integrations') {
      if (!process.env.POSTIZ_API_KEY) {
        return json(res, 200, { configured: false, apiUrl: SocialDistributionEngine.getApiUrl(), integrations: [] });
      }
      const integrations = await SocialDistributionEngine.listIntegrations();
      return json(res, 200, { configured: true, apiUrl: SocialDistributionEngine.getApiUrl(), integrations });
    }
    if (req.method === 'POST' && url.pathname === '/api/postiz/connect') {
      const body = await readBody(req, 16 * 1024);
      const apiUrl = normalizePostizApiUrl(body.apiUrl);
      const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
      if (apiKey.length < 8 || apiKey.length > 500 || /[\r\n]/.test(apiKey)) {
        return json(res, 400, { error: 'Informe uma chave Postiz válida, sem quebras de linha.' });
      }
      const integrations = await SocialDistributionEngine.listIntegrations(apiUrl, apiKey);
      await saveLocalEnvValue('POSTIZ_API_URL', apiUrl);
      await saveLocalEnvValue('POSTIZ_API_KEY', apiKey);
      return json(res, 200, { success: true, configured: true, apiUrl, integrations, message: `Conexão validada. ${integrations.length} canal(is) disponível(is). Nenhum post foi enviado.` });
    }
    if (req.method === 'GET' && url.pathname === '/api/trends') {
      const brand: BrandDna = JSON.parse(await fs.readFile(path.join(root, 'config', 'brand_dna.json'), 'utf8'));
      const signals = await TrendHunter.scanNicheTrends(['AI agents', 'artificial intelligence', 'automation', 'software']);
      const ranked = scorer.scoreAndRankTopics(signals, brand).slice(0, 8);
      return json(res, 200, { trends: ranked, live: signals.some((signal: any) => signal.isLive === true), scannedAt: new Date().toISOString() });
    }
    if (req.method === 'POST' && url.pathname === '/api/content/generate') {
      const body = await readBody(req);
      const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
      if (topic.length < 8 || topic.length > 200) return json(res, 400, { error: 'Escolha uma pauta com 8 a 200 caracteres.' });
      const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      state.createJob(jobId, topic);
      const result = await persistContent(jobId, topic);
      return json(res, 200, { success: true, job: parseJob(state.getJob(jobId)), ...result });
    }
    if (req.method === 'GET' && url.pathname === '/api/schedules/preview') {
      const schedules = platformList.map((platform) => ({ platform, ...SocialDistributionEngine.getReferenceScheduleTime(platform) }));
      return json(res, 200, { schedules, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    }
    const distributionPreviewMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/distribution-preview$/);
    if (req.method === 'GET' && distributionPreviewMatch) {
      const job = state.getJob(decodeURIComponent(distributionPreviewMatch[1]));
      if (!job) return json(res, 404, { error: 'Conteúdo não encontrado.' });
      if (!process.env.POSTIZ_API_KEY) return json(res, 200, { configured: false, channels: [], message: 'Conecte o Postiz na seção Canais antes de agendar.' });
      const integrations = await SocialDistributionEngine.listIntegrations();
      const jobOutputDir = job.outputDir && inside(outputDir, job.outputDir) ? job.outputDir : null;
      const outputFiles = jobOutputDir ? await fs.readdir(jobOutputDir).catch(() => []) : [];
      const slides = outputFiles.filter((name: string) => /^slide_\d+\.png$/i.test(name)).sort().map((name: string) => path.join(jobOutputDir!, name));
      const videoDir = path.join(outputDir, 'video_reels');
      const videos = (await fs.readdir(videoDir).catch(() => [])).filter((name: string) => /^reels_final_.*\.mp4$/i.test(name)).sort().reverse();
      const videoPath = videos[0] ? path.join(videoDir, videos[0]) : null;
      const videoStats = videoPath ? await fs.stat(videoPath).catch(() => null) : null;
      const reels = parseJob(job).reelsScript || {};
      const channels = integrations.map((channel) => {
        const platform = getBasePlatform(channel.identifier);
        const needsVideo = platform === 'tiktok' || platform === 'youtube';
        const availableMedia = needsVideo ? (videoPath ? [videoPath] : []) : (platform === 'threads' ? slides.slice(0, 1) : slides);
        const tooLarge = needsVideo && videoStats && videoStats.size > 49 * 1024 * 1024;
        const disabledReason = channel.disabled ? 'Canal desativado no Postiz.' :
          tooLarge ? 'O vídeo editado excede o limite de 49 MB do upload Postiz.' :
            availableMedia.length === 0 ? (needsVideo ? 'Edite um vídeo no Estúdio antes de agendar.' : 'O carrossel renderizado não foi encontrado.') : null;
        const caption = platform === 'linkedin' ? (job.linkedinPost || job.topic) :
          platform === 'youtube' ? `${reels.body || reels.hook || job.topic}\n\n${reels.cta || ''}`.trim() :
            `${reels.hook || job.topic}\n\n${reels.cta || ''}`.trim();
        const schedule = SocialDistributionEngine.getReferenceScheduleTime(platform);
        return {
          id: channel.id, name: channel.name, profile: channel.profile, picture: channel.picture,
          identifier: channel.identifier, platform, disabled: Boolean(disabledReason), disabledReason,
          scheduledTime: schedule.scheduledTime, scheduleReason: schedule.reason,
          caption, mediaType: needsVideo ? 'video' : (platform === 'threads' ? 'image' : 'carousel'),
          mediaCount: availableMedia.length, mediaNames: availableMedia.map((file) => path.basename(file)),
          videoTitle: job.topic.slice(0, 100)
        };
      });
      return json(res, 200, {
        configured: true, channels,
        videoName: videoPath ? path.basename(videoPath) : null,
        videoTooLarge: Boolean(videoStats && videoStats.size > 49 * 1024 * 1024),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
    }
    const jobMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)$/);
    if (req.method === 'GET' && jobMatch) {
      const job = state.getJob(decodeURIComponent(jobMatch[1]));
      if (!job) return json(res, 404, { error: 'Conteúdo não encontrado.' });
      const folderFiles = job.outputDir ? await fs.readdir(job.outputDir).catch(() => []) : [];
      const slides = job.outputDir ? folderFiles.filter((name: string) => /^slide_\d+\.png$/i.test(name)).sort().map((name: string) => mediaUrl(path.join(job.outputDir!, name))) : [];
      let schedules = null;
      if (job.outputDir) {
        try { schedules = JSON.parse(await fs.readFile(path.join(job.outputDir, 'distribuicao.json'), 'utf8')); } catch { /* sem aprovação/agendamento */ }
      }
      const reportPath = job.outputDir ? path.join(job.outputDir, 'ROTEIROS_E_POSTS.md') : '';
      return json(res, 200, { job: parseJob(job), slides, schedules, reportUrl: reportPath && inside(root, reportPath) && await fs.access(reportPath).then(() => true).catch(() => false) ? mediaUrl(reportPath) : null });
    }
    const approveMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/approve$/);
    if (req.method === 'POST' && approveMatch) {
      const jobId = decodeURIComponent(approveMatch[1]);
      const job = state.getJob(jobId);
      if (!job) return json(res, 404, { error: 'Conteúdo não encontrado.' });
      if (job.status !== 'AWAITING_APPROVAL') return json(res, 409, { error: 'Este conteúdo não está aguardando aprovação.' });
      const body = await readBody(req, 64 * 1024);
      if (!process.env.POSTIZ_API_KEY) return json(res, 409, { error: 'Conecte o Postiz na seção Canais antes de aprovar um agendamento.' });
      if (!Array.isArray(body.targets) || body.targets.length === 0 || body.targets.length > 15) {
        return json(res, 400, { error: 'Selecione ao menos um canal Postiz disponível.' });
      }
      const integrations = await SocialDistributionEngine.listIntegrations();
      const integrationById = new Map(integrations.map((item) => [item.id, item]));
      const targets = body.targets;
      const seen = new Set<string>();
      const prepared: Array<{ target: any; channel: PostizIntegration; mediaPaths: string[] }> = [];
      const jobOutputDir = job.outputDir && inside(outputDir, job.outputDir) ? job.outputDir : null;
      const outputFiles = jobOutputDir ? await fs.readdir(jobOutputDir).catch(() => []) : [];
      const slidePaths = jobOutputDir ? outputFiles.filter((name: string) => /^slide_\d+\.png$/i.test(name)).sort().map((name: string) => path.join(jobOutputDir!, name)) : [];
      const videoDir = path.join(outputDir, 'video_reels');
      const videos = (await fs.readdir(videoDir).catch(() => [])).filter((name: string) => /^reels_final_.*\.mp4$/i.test(name)).sort().reverse();
      const videoPath = videos[0] ? path.join(videoDir, videos[0]) : null;
      for (const target of targets) {
        const id = typeof target.integrationId === 'string' ? target.integrationId : '';
        if (!id || seen.has(id)) return json(res, 400, { error: 'A seleção contém um canal vazio ou repetido.' });
        seen.add(id);
        const channel = integrationById.get(id);
        if (!channel || channel.disabled || !isSupportedIntegration(channel)) return json(res, 400, { error: 'Um dos canais escolhidos não está conectado, está desativado ou não é compatível.' });
        if (typeof target.caption !== 'string' || !target.caption.trim() || target.caption.length > 5000) return json(res, 400, { error: `Revise o texto da publicação para ${channel.name}.` });
        if (typeof target.scheduledTime !== 'string' || !Number.isFinite(Date.parse(target.scheduledTime)) || Date.parse(target.scheduledTime) <= Date.now()) return json(res, 400, { error: `O horário exibido para ${channel.name} expirou. Abra a aprovação novamente.` });
        const platform = getBasePlatform(channel.identifier);
        const mediaPaths = platform === 'tiktok' || platform === 'youtube' ? (videoPath ? [videoPath] : []) : (platform === 'threads' ? slidePaths.slice(0, 1) : slidePaths);
        if (mediaPaths.length === 0) return json(res, 409, { error: platform === 'tiktok' || platform === 'youtube' ? 'Edite um vídeo no Estúdio antes de selecionar TikTok ou YouTube.' : 'O carrossel desta pauta ainda não foi renderizado.' });
        const mediaStat = await fs.stat(mediaPaths[0]).catch(() => null);
        if ((platform === 'tiktok' || platform === 'youtube') && (!mediaStat || mediaStat.size > 49 * 1024 * 1024)) return json(res, 413, { error: 'O vídeo precisa existir e ter até 49 MB para upload seguro ao Postiz.' });
        prepared.push({ target, channel, mediaPaths });
      }
      const youtubeVisibility = body.youtubeVisibility;
      const youtubeMadeForKids = body.youtubeMadeForKids;
      const tiktokPrivacy = body.tiktokPrivacy;
      if (prepared.some(({ channel }) => getBasePlatform(channel.identifier) === 'youtube') &&
        (!['public', 'unlisted', 'private'].includes(youtubeVisibility) || !['yes', 'no'].includes(youtubeMadeForKids))) {
        return json(res, 400, { error: 'Confirme a visibilidade e a classificação de público do YouTube.' });
      }
      if (prepared.some(({ channel }) => getBasePlatform(channel.identifier) === 'tiktok') &&
        (!['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY'].includes(tiktokPrivacy) ||
          typeof body.tiktokBrandContent !== 'boolean' || typeof body.tiktokBrandOrganic !== 'boolean' || typeof body.videoMadeWithAI !== 'boolean')) {
        return json(res, 400, { error: 'Confirme a privacidade e as declarações de marca/IA do TikTok.' });
      }
      state.setStatus(jobId, 'APPROVING', 'Enviando os canais e horários que você confirmou ao Postiz.');
      const mediaCache = new Map<string, { id: string; path: string }>();
      const schedules: any[] = [];
      const failures: Array<{ integrationId: string; integrationName: string; error: string }> = [];
      for (const { target, channel, mediaPaths } of prepared) {
        try {
          const media = [];
          for (const filePath of mediaPaths) {
            let asset = mediaCache.get(filePath);
            if (!asset) {
              asset = await SocialDistributionEngine.uploadMedia(filePath);
              mediaCache.set(filePath, asset);
            }
            media.push(asset);
          }
          const options: ScheduleOptions = {
            tiktokTitle: job.topic,
            youtubeTitle: job.topic,
            youtubeVisibility,
            youtubeMadeForKids,
            tiktokPrivacy,
            tiktokBrandContent: body.tiktokBrandContent,
            tiktokBrandOrganic: body.tiktokBrandOrganic,
            videoMadeWithAI: body.videoMadeWithAI
          };
          const result = await SocialDistributionEngine.createScheduledPost({
            approved: true,
            channel,
            caption: target.caption,
            scheduledTime: target.scheduledTime,
            media,
            options
          });
          schedules.push(result);
        } catch (error: any) {
          failures.push({ integrationId: channel.id, integrationName: channel.name, error: error?.message || 'Falha sem detalhes do Postiz.' });
        }
      }
      const successful = schedules.length;
      if (successful === 0) {
        state.setStatus(jobId, 'AWAITING_APPROVAL', failures[0]?.error || 'O Postiz não confirmou nenhum agendamento.');
        return json(res, 502, { error: failures[0]?.error || 'O Postiz não confirmou nenhum agendamento.', failures });
      }
      const allScheduled = failures.length === 0;
      const result = { schedules, failures, partial: !allScheduled };
      const output = jobOutputDir ? path.join(jobOutputDir, 'distribuicao.json') : null;
      if (output) await fs.writeFile(output, JSON.stringify(result, null, 2), 'utf8');
      state.setStatus(jobId, allScheduled ? 'SCHEDULED' : 'PARTIALLY_SCHEDULED', allScheduled ? 'Todos os canais selecionados foram aceitos pelo Postiz.' : `${successful} canal(is) agendado(s); ${failures.length} falhou(ram). Veja distribuicao.json e não repita os canais já agendados.`);
      return json(res, 200, {
        success: true,
        status: allScheduled ? 'SCHEDULED' : 'PARTIALLY_SCHEDULED',
        scheduled: true,
        partial: !allScheduled,
        schedules,
        failures,
        message: allScheduled ? `O Postiz aceitou o agendamento em ${successful} canal(is).` : `Agendamentos parciais: ${successful} canal(is) aceito(s), ${failures.length} com erro. Não repita os canais já agendados.`
      });
    }
    const rejectMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/reject$/);
    if (req.method === 'POST' && rejectMatch) {
      const jobId = decodeURIComponent(rejectMatch[1]);
      const job = state.getJob(jobId);
      if (!job) return json(res, 404, { error: 'Conteúdo não encontrado.' });
      state.setStatus(jobId, 'REJECTED', 'Reprovado pelo criador.');
      return json(res, 200, { success: true, status: 'REJECTED' });
    }
    if (req.method === 'POST' && url.pathname === '/api/brand') {
      const body = await readBody(req);
      const file = path.join(root, 'config', 'brand_dna.json');
      const brand = JSON.parse(await fs.readFile(file, 'utf8')) as BrandDna;
      if (typeof body.tone === 'string' && body.tone.trim().length >= 8 && body.tone.length <= 240) brand.style.tone = body.tone.trim();
      if (typeof body.pacing === 'string' && body.pacing.trim().length >= 8 && body.pacing.length <= 240) brand.style.pacing = body.pacing.trim();
      await fs.writeFile(file, `${JSON.stringify(brand, null, 2)}\n`, 'utf8');
      return json(res, 200, { success: true, style: brand.style });
    }
    if (req.method === 'GET' && url.pathname === '/api/analytics') {
      return json(res, 200, { ...analytics.getMetricsSummary(), leaderboard: analytics.getWeeklyLeaderboard(), jobs: state.listJobs(100).map(({ id, topic, status, createdAt }: any) => ({ id, topic, status, createdAt })) });
    }
    if (req.method === 'POST' && url.pathname === '/api/metrics') {
      const body = await readBody(req);
      const job = typeof body.jobId === 'string' ? state.getJob(body.jobId) : null;
      if (!job) return json(res, 400, { error: 'Selecione uma pauta existente.' });
      if (!platformList.includes(body.platform)) return json(res, 400, { error: 'Plataforma inválida.' });
      const numeric = ['views', 'likes', 'shares', 'saves', 'comments', 'retentionRatePct'];
      if (numeric.some((key) => !Number.isFinite(Number(body[key])) || Number(body[key]) < 0) || Number(body.retentionRatePct) > 100) return json(res, 400, { error: 'Informe métricas não negativas e retenção entre 0 e 100%.' });
      analytics.recordMetrics({ id: `metric_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, jobId: job.id, platform: body.platform, views: Math.round(Number(body.views)), likes: Math.round(Number(body.likes)), shares: Math.round(Number(body.shares)), saves: Math.round(Number(body.saves)), comments: Math.round(Number(body.comments)), retentionRatePct: Number(body.retentionRatePct) });
      return json(res, 201, { success: true, ...analytics.getMetricsSummary() });
    }
    if (req.method === 'POST' && url.pathname === '/api/newsletter') {
      const body = await readBody(req);
      const leaderboard = analytics.getWeeklyLeaderboard();
      if (analytics.getMetricsSummary().weeklyMetricsCount === 0) return json(res, 409, { error: 'Registre métricas reais dos últimos sete dias antes de montar a newsletter semanal.' });
      const creator = typeof body.creator === 'string' && body.creator.trim() ? body.creator.trim() : 'Kevin';
      const draft = analytics.generateWeeklyNewsletter(creator);
      await fs.mkdir(outputDir, { recursive: true });
      const filePath = path.join(outputDir, `${draft.id}.md`);
      await fs.writeFile(filePath, draft.newsletterMarkdown, 'utf8');
      return json(res, 200, { success: true, draft: { ...draft, downloadUrl: mediaUrl(filePath) }, leaderboard });
    }
    if (req.method === 'POST' && url.pathname === '/api/video/upload') {
      const fileNameHeader = String(req.headers['x-file-name'] || 'video.mp4');
      const original = path.basename(decodeURIComponent(fileNameHeader)).replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(-120);
      if (!/\.(mp4|mov|mkv|webm)$/i.test(original)) return json(res, 400, { error: 'Formato de vídeo não suportado. Envie MP4, MOV, MKV ou WebM.' });
      await fs.mkdir(videoInputDir, { recursive: true });
      const safeName = `${Date.now()}_${original}`;
      const filePath = path.join(videoInputDir, safeName);
      const handle = await fs.open(filePath, 'w');
      let bytes = 0;
      try {
        for await (const chunk of req) {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          bytes += buffer.length;
          if (bytes > 300 * 1024 * 1024) throw Object.assign(new Error('Vídeos têm limite local de 300 MB.'), { statusCode: 413 });
          await handle.write(buffer);
        }
      } catch (error) { await fs.unlink(filePath).catch(() => undefined); throw error; }
      finally { await handle.close(); }
      return json(res, 201, { success: true, name: safeName, bytes, message: 'Vídeo salvo localmente. Inicie a edição quando estiver pronto.' });
    }
    if (req.method === 'POST' && url.pathname === '/api/video/process') {
      const files = (await fs.readdir(videoInputDir).catch(() => [])).filter((name) => /\.(mp4|mov|mkv|webm)$/i.test(name)).sort().reverse();
      if (!files.length) return json(res, 409, { error: 'Envie um vídeo bruto antes de iniciar a edição.' });
      const selected = typeof req.headers['x-video-name'] === 'string' ? path.basename(req.headers['x-video-name']) : files[0];
      if (!files.includes(selected)) return json(res, 404, { error: 'Vídeo selecionado não encontrado na pasta local.' });
      const destination = path.join(outputDir, 'video_reels');
      const result = await new VideoAutoEditor().processFullReels(path.join(videoInputDir, selected), destination);
      const hasCaptions = Boolean(result.transcriptText && result.transcriptText.trim().length > 0);
      return json(res, 200, {
        success: true,
        result: { ...result, finalVideo: mediaUrl(result.finalVideo), jumpCutVideo: mediaUrl(result.jumpCutVideo), subtitlesAss: mediaUrl(result.subtitlesAss) },
        captionsAvailable: hasCaptions,
        notice: hasCaptions ? `Edição completa: ${result.overlaysRendered || 5} camadas de Motion Graphics (Hook Banner + Balões de Texto) + Legendas Cinéticas sincronizadas.` : 'Corte, Motion Overlays e masterização aplicados. Configure GEMINI_API_KEY para transcrever novos vídeos automaticamente.'
      });
    }
    // Rotas Isoladas do MoneyPrinterTurbo
    if (req.method === 'POST' && url.pathname === '/api/moneyprinter/generate') {
      const body = await readBody(req);
      if (!body.videoSubject || typeof body.videoSubject !== 'string' || !body.videoSubject.trim()) {
        return json(res, 400, { error: 'Informe um tema ou palavra-chave para o vídeo.' });
      }
      const task = await moneyPrinter.startTask({
        videoSubject: body.videoSubject.trim(),
        videoScript: body.videoScript ? String(body.videoScript).trim() : undefined,
        videoOrientation: body.videoOrientation === 'landscape' ? 'landscape' : 'portrait',
        voiceName: body.voiceName ? String(body.voiceName).trim() : 'pt-BR-AntonioNeural',
        pexelsApiKey: body.pexelsApiKey ? String(body.pexelsApiKey).trim() : undefined,
      });
      return json(res, 202, { success: true, task });
    }
    if (req.method === 'GET' && url.pathname === '/api/moneyprinter/tasks') {
      const tasks = await moneyPrinter.listTasks();
      const enriched = tasks.map(t => ({
        ...t,
        videoUrl: t.videoPath ? mediaUrl(t.videoPath) : undefined,
        audioUrl: t.audioPath ? mediaUrl(t.audioPath) : undefined,
      }));
      return json(res, 200, { success: true, tasks: enriched });
    }
    if (req.method === 'GET' && url.pathname.startsWith('/api/moneyprinter/tasks/')) {
      const taskId = url.pathname.slice('/api/moneyprinter/tasks/'.length);
      const task = moneyPrinter.getTask(taskId);
      if (!task) return json(res, 404, { error: 'Tarefa do MoneyPrinter não encontrada.' });
      return json(res, 200, {
        success: true,
        task: {
          ...task,
          videoUrl: task.videoPath ? mediaUrl(task.videoPath) : undefined,
          audioUrl: task.audioPath ? mediaUrl(task.audioPath) : undefined,
        }
      });
    }
    if (req.method === 'GET' && url.pathname.startsWith('/media/')) {
      const rel = url.pathname.slice('/media/'.length).split('/').map((part) => decodeURIComponent(part)).join(path.sep);
      if (await serveLocalFile(res, root, rel)) return;
      return json(res, 404, { error: 'Arquivo não encontrado.' });
    }
    if (req.method === 'GET' && url.pathname.startsWith('/assets/')) {
      const rel = url.pathname.slice('/assets/'.length).split('/').map((part) => decodeURIComponent(part)).join(path.sep);
      if (await serveLocalFile(res, path.join(root, 'assets'), rel)) return;
      return json(res, 404, { error: 'Ativo não encontrado.' });
    }
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      if (await serveLocalFile(res, publicDir, 'index.html')) return;
      return json(res, 500, { error: 'Interface pública não encontrada em public/index.html.' });
    }
    if (req.method === 'GET' && url.pathname.startsWith('/ui/')) {
      const rel = url.pathname.slice('/ui/'.length).split('/').map((part) => decodeURIComponent(part)).join(path.sep);
      if (await serveLocalFile(res, publicDir, rel)) return;
    }
    return json(res, 404, { error: 'Rota não encontrada.' });
  } catch (error: any) {
    console.error(`[Cockpit] ${req.method} ${url.pathname}:`, error);
    return json(res, error.statusCode || 500, { error: error.message || 'Erro interno do cockpit.' });
  }
}

const server = http.createServer((req, res) => { void handler(req, res); });
server.listen(port, '127.0.0.1', () => {
  console.log(`Cockpit local pronto: http://127.0.0.1:${port}`);
  console.log('Aprovação humana obrigatória; sem integração configurada, nada é enviado às redes.');
});
