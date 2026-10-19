const app = {
  dashboard: null,
  trends: [],
  trendLive: false,
  page: 'inicio',
  selectedJob: null,
  selectedSlides: [],
  reportUrl: null,
  file: null,
  uploadedName: '',
  pendingApproval: null,
  postizIntegrations: [],
  approvalChannels: []
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const formatNumber = value => new Intl.NumberFormat('pt-BR').format(Number(value || 0));
const platformNames = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', threads: 'Threads', linkedin: 'LinkedIn' };
const postizNames = { instagram: 'Instagram', 'instagram-standalone': 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', threads: 'Threads', linkedin: 'LinkedIn', 'linkedin-page': 'Página do LinkedIn' };
const statusNames = { AWAITING_APPROVAL: 'Aguardando aprovação', APPROVING: 'Enviando ao Postiz', APPROVED: 'Aprovado · local', SCHEDULED: 'Agendado', PARTIALLY_SCHEDULED: 'Agendamento parcial · confira', REJECTED: 'Reprovado', LEGACY_UNVERIFIED: 'Histórico · não verificado', TOPIC_SELECTED: 'Em produção', TOPIC_SUGGESTED: 'Sugerido', CONTENT_GENERATED: 'Em produção' };

async function api(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Não foi possível concluir a ação (${response.status}).`);
  return data;
}
function toast(message, type = 'success', duration = 4500) {
  const host = $('#toast-stack');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  host.append(el);
  window.setTimeout(() => el.remove(), duration);
}
function setBusy(button, busy, label) {
  if (!button) return;
  if (busy) { button.dataset.oldText = button.innerHTML; button.innerHTML = `<span class="spinner"></span> ${escapeHtml(label || 'Aguarde…')}`; button.disabled = true; }
  else { button.innerHTML = button.dataset.oldText || button.innerHTML; button.disabled = false; }
}
function statusBadge(status) {
  const cls = status === 'AWAITING_APPROVAL' ? 'pending' : status === 'REJECTED' ? 'rejected' : status === 'LEGACY_UNVERIFIED' ? 'unverified' : '';
  return `<span class="status-badge ${cls}">${escapeHtml(statusNames[status] || status || 'Rascunho')}</span>`;
}
function showPage(name) {
  app.page = name;
  $$('.page').forEach(page => page.classList.toggle('active', page.id === `page-${name}`));
  $$('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.page === name));
  const labels = { inicio: 'Visão geral', radar: 'Radar de pautas', conteudos: 'Biblioteca', estudio: 'Estúdio de vídeo', metricas: 'Métricas', canais: 'Canais Postiz', marca: 'Voz da marca', moneyprinter: 'MoneyPrinter Turbo' };
  $('#page-crumb').textContent = labels[name] || 'Visão geral';
  if (name === 'conteudos') renderLibrary();
  if (name === 'metricas') loadAnalytics();
  if (name === 'canais') loadPostizChannels();
  if (name === 'moneyprinter') loadMptTasks();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderTrendRow(item, index, compact = false) {
  const trend = item.topic || item;
  const title = trend.title || 'Pauta sugerida';
  const score = Math.max(0, Math.min(100, Number(item.affinityScore || 0)));
  const velocity = Number(trend.velocityScore || 0);
  const source = trend.source || 'Fonte não identificada';
  const liveLabel = trend.isLive ? 'sinal público' : 'referência editorial';
  const sourceLink = trend.sourceUrl ? `<a class="source-link" href="${escapeHtml(trend.sourceUrl)}" target="_blank" rel="noreferrer">Ver fonte ↗</a>` : '';
  if (compact) return `<article class="trend-item"><span class="trend-rank">${String(index + 1).padStart(2, '0')}</span><div><button class="trend-open" data-generate="${escapeHtml(title)}"><div class="trend-title">${escapeHtml(title)}</div></button><div class="trend-meta"><span>${escapeHtml(source)}</span><span>·</span><span>${liveLabel}</span></div></div><span class="trend-score">${score}%</span></article>`;
  return `<article class="radar-result-card"><div class="radar-result-rank">${String(index + 1).padStart(2, '0')}</div><div><h3 class="radar-result-title">${escapeHtml(title)}</h3><p class="radar-result-summary">${escapeHtml(trend.summary || item.rationale || 'Sinal público para inspiração editorial.')}</p><div class="radar-result-meta"><span class="source-pill">${escapeHtml(source)}</span><span>${trend.isLive ? 'Sinal público ·' : 'Referência editorial ·'} ${trend.isLive ? `${formatNumber(velocity)} pontos de tração` : 'sem validação ao vivo'}</span><span class="affinity-meter" title="Afinidade editorial"><i style="width:${score}%"></i></span><strong>${score}% afinidade</strong></div><div class="radar-actions"><button class="button button-dark" data-generate="${escapeHtml(title)}">Criar conteúdo com esta pauta <span>↗</span></button>${sourceLink}</div></div></article>`;
}
function renderTrends() {
  const home = $('#home-trends');
  const radar = $('#radar-results');
  if (!app.trends.length) {
    const empty = `<div class="text-empty">Nenhum sinal disponível agora. Você ainda pode criar conteúdo com sua própria pauta.</div>`;
    home.innerHTML = empty; radar.innerHTML = empty; return;
  }
  home.innerHTML = app.trends.slice(0, 3).map((trend, i) => renderTrendRow(trend, i, true)).join('');
  radar.innerHTML = app.trends.map((trend, i) => renderTrendRow(trend, i)).join('');
  $('#radar-count').textContent = String(app.trends.length);
  $('#radar-source').textContent = app.trendLive ? 'HACKER NEWS · SINAIS PÚBLICOS AO VIVO' : 'SEM CONEXÃO · SUGESTÕES EDITORIAIS LOCAIS';
  $('#radar-updated').textContent = `Atualizado ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  $('#radar-notice').innerHTML = app.trendLive
    ? '<span>ⓘ</span><p>Conectado ao Hacker News Algolia. “Tração” reflete pontos e comentários públicos; afinidade é editorial, não promessa de alcance.</p>'
    : '<span>ⓘ</span><p>Sem sinal ao vivo no momento. Estas referências ajudam na pauta, mas não representam tendências verificadas. Tente atualizar mais tarde ou escreva sua própria ideia.</p>';
}
async function loadTrends(showToast = false) {
  const button = $('#scan-trends');
  if (button) setBusy(button, true, 'Buscando…');
  try {
    const data = await api('/api/trends');
    app.trends = data.trends || [];
    app.trendLive = Boolean(data.live);
    renderTrends();
    if (showToast) toast(app.trendLive ? 'Radar atualizado com sinais públicos do Hacker News.' : 'Não há conexão com sinais ao vivo. Sugestões locais identificadas como referência.', app.trendLive ? 'success' : '');
  } catch (error) { toast(error.message, 'error'); }
  finally { if (button) setBusy(button, false); }
}
function renderLatest() {
  const box = $('#latest-content');
  const job = app.dashboard?.latest;
  if (!job) {
    box.innerHTML = `<div class="empty-state compact"><span class="empty-glyph">✳</span><strong>Seu próximo conteúdo começa aqui.</strong><span>Escolha uma pauta no radar e gere o pacote completo.</span><button class="small-button" data-go="radar">Explorar pautas <span>→</span></button></div>`;
    return;
  }
  const image = app.dashboard.slides?.[0] || '';
  box.innerHTML = `<div class="latest-preview" data-open-job="${escapeHtml(job.id)}">${image ? `<img src="${image}" alt="Capa do carrossel">` : '<span class="library-cover"></span>'}<div class="latest-preview-copy"><span class="section-tag">${escapeHtml(new Date(job.createdAt).toLocaleDateString('pt-BR'))}</span><strong>${escapeHtml(job.topic)}</strong><small>${statusBadge(job.status)}</small></div></div>`;
}
function updateDashboard() {
  const data = app.dashboard;
  if (!data) return;
  $('#profile-name').textContent = data.creator?.name || 'Kevin';
  $('#profile-handle').textContent = data.creator?.handle || '@kevin.tech';
  $('#brand-niche').textContent = data.brand?.niche || '';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  $('.welcome-row h1').innerHTML = `${greeting}, ${escapeHtml(data.creator?.name || 'Kevin')}<span class="title-period">.</span>`;
  $('#today-label').textContent = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()).toUpperCase();
  const jobs = data.jobs || [];
  const pending = jobs.filter(job => job.status === 'AWAITING_APPROVAL').length;
  $('#stat-created').textContent = formatNumber(jobs.length);
  $('#stat-pending').textContent = formatNumber(pending);
  $('#jobs-count').textContent = String(jobs.length);
  $('#stat-reach').textContent = '—';
  $('#stat-reach-note').textContent = 'Aguardando métricas registradas';
  $('#hero-status').textContent = data.integrations?.gemini ? 'ESTÚDIO LOCAL · IA CONECTADA' : 'ESTÚDIO LOCAL · MODO SEM API';
  renderLatest();
  fillMetricJobs();
  fillBrandForm(data.brand);
}
async function reloadDashboard() {
  try { app.dashboard = await api('/api/dashboard'); updateDashboard(); }
  catch (error) { toast(`Não foi possível carregar o cockpit: ${error.message}`, 'error'); }
}
async function refreshAll() { await reloadDashboard(); if (app.page === 'radar' || app.page === 'inicio') await loadTrends(); if (app.page === 'metricas') await loadAnalytics(); }

function openGenerateDialog() {
  $('#dialog-content').innerHTML = `<div class="dialog-body"><div class="empty-state"><span class="spinner"></span><strong>Construindo seu pacote editorial…</strong><span>A geração e a renderização do carrossel rodam no computador.</span></div></div>`;
  $('#content-dialog').showModal();
}
async function generateContent(topic, button) {
  const clean = String(topic || '').trim();
  if (clean.length < 8) { toast('Escolha uma pauta com pelo menos 8 caracteres.', 'error'); return; }
  if (button) setBusy(button, true, 'Gerando pacote…');
  openGenerateDialog();
  try {
    const result = await api('/api/content/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: clean }) });
    app.selectedJob = result.job;
    app.selectedSlides = result.carousel.slides || [];
    app.reportUrl = result.reportUrl || null;
    showJobDialog(result.job, app.selectedSlides);
    await reloadDashboard();
    toast('Pacote gerado e salvo localmente. Revise antes de aprovar.');
  } catch (error) {
    $('#content-dialog').close();
    toast(error.message, 'error', 6500);
  } finally { if (button) setBusy(button, false); }
}
function textContent(value) { return `<div class="content-long">${escapeHtml(value || 'Ainda não há conteúdo neste formato.')}</div>`; }
function showJobDialog(job, slideUrls = [], reportUrl = app.reportUrl) {
  app.selectedJob = job;
  app.selectedSlides = slideUrls;
  const content = job || {};
  const reels = content.reelsScript || {};
  const blog = content.blogPost || {};
  const newsletter = content.newsletter || {};
  const slides = content.carouselData?.slides || [];
  const sections = {
    reels: `<div class="tab-content"><span class="section-tag">GANCHO</span><p>${escapeHtml(reels.hook || '')}</p><span class="section-tag">ROTEIRO FALADO</span><p class="content-long">${escapeHtml(reels.body || '')}</p><span class="section-tag">DIREÇÃO VISUAL</span><p>${escapeHtml(reels.visualNotes || '')}</p><span class="section-tag">CTA</span><p>${escapeHtml(reels.cta || '')}</p></div>`,
    carousel: `<div class="tab-content">${slideUrls.length ? `<div class="slide-gallery">${slideUrls.map((url, index) => `<figure><img loading="lazy" src="${escapeHtml(url)}" alt="Slide ${index + 1}"><figcaption>SLIDE ${String(index + 1).padStart(2, '0')}</figcaption></figure>`).join('')}</div>` : textContent(slides.map((slide, index) => `SLIDE ${index + 1}\n${slide.headline || slide.subtitle || slide.body || ''}`).join('\n\n'))}</div>`,
    linkedin: `<div class="tab-content">${textContent(content.linkedinPost || '')}</div>`,
    blog: `<div class="tab-content"><span class="section-tag">${escapeHtml(blog.metaDescription || '')}</span><h3>${escapeHtml(blog.title || '')}</h3>${textContent(blog.markdown || '')}</div>`,
    newsletter: `<div class="tab-content"><span class="section-tag">ASSUNTO</span><p>${escapeHtml(newsletter.subject || '')}</p>${textContent(newsletter.bodyMarkdown || '')}</div>`
  };
  $('#dialog-content').innerHTML = `<div class="dialog-body"><div class="dialog-heading"><div><p class="eyebrow">PACOTE EDITORIAL · ${escapeHtml(content.id || '')}</p><h2>${escapeHtml(content.topic || '')}</h2><p>Gerado para a voz de ${escapeHtml(app.dashboard?.creator?.handle || '@kevin.tech')} · ${escapeHtml(new Date(content.createdAt || Date.now()).toLocaleString('pt-BR'))}</p></div>${statusBadge(content.status)}</div><div class="dialog-tabs">${[['reels','Reels'],['carousel','Carrossel'],['linkedin','LinkedIn'],['blog','Blog'],['newsletter','Newsletter']].map(([key, label], index) => `<button class="dialog-tab ${index === 0 ? 'active' : ''}" data-tab="${key}">${label}</button>`).join('')}</div><div id="tab-panel">${sections.reels}</div><div class="dialog-footer"><small>${content.status === 'AWAITING_APPROVAL' ? 'Rascunho local · nada foi publicado.' : escapeHtml(content.feedback || statusNames[content.status] || '')}</small><div class="dialog-footer-actions">${content.status === 'AWAITING_APPROVAL' ? `<button class="button button-outline" data-reject="${escapeHtml(content.id)}">Reprovar</button><button class="button button-dark" data-approve="${escapeHtml(content.id)}">Revisar aprovação <span>↗</span></button>` : reportUrl ? `<a class="button button-outline" href="${escapeHtml(reportUrl)}" download>Baixar pacote .md ↗</a>` : ''}</div></div></div>`;
  $$('.dialog-tab').forEach(button => button.addEventListener('click', () => {
    $$('.dialog-tab').forEach(tab => tab.classList.toggle('active', tab === button));
    $('#tab-panel').innerHTML = sections[button.dataset.tab];
  }));
  if (!$('#content-dialog').open) $('#content-dialog').showModal();
}
async function openSavedJob(jobId) {
  try {
    const data = await api(`/api/jobs/${encodeURIComponent(jobId)}`);
    app.reportUrl = data.reportUrl || null;
    showJobDialog(data.job, data.slides || [], app.reportUrl);
  } catch (error) { toast(error.message, 'error'); }
}
function renderLibrary() {
  const jobs = app.dashboard?.jobs || [];
  $('#library-summary').textContent = jobs.length ? `${jobs.length} ${jobs.length === 1 ? 'pauta salva' : 'pautas salvas'} neste computador` : 'Sua biblioteca está pronta para a primeira pauta.';
  $('#library-list').innerHTML = jobs.length ? jobs.map(job => {
    const isLatest = job.id === app.dashboard.latest?.id;
    const image = isLatest ? app.dashboard.slides?.[0] : '';
    return `<article class="library-card" data-open-job="${escapeHtml(job.id)}"><img class="library-cover" src="${escapeHtml(image || '/assets/user/profile.svg')}" alt="Miniatura"><div class="library-details"><span class="section-tag">${escapeHtml(new Date(job.createdAt).toLocaleDateString('pt-BR'))}</span><h3>${escapeHtml(job.topic)}</h3><small>${escapeHtml(job.id)}</small>${statusBadge(job.status)}</div></article>`;
  }).join('') : `<div class="panel empty-page"><span class="empty-glyph">✳</span><strong>Nenhum conteúdo por aqui, ainda.</strong>Encontre uma pauta no radar ou comece por uma ideia sua.<br><button class="button button-dark" style="margin-top:14px" data-go="radar">Explorar pautas ↗</button></div>`;
  fillMetricJobs();
}
function fillMetricJobs() {
  const select = $('#metric-job');
  if (!select || !app.dashboard) return;
  const current = select.value;
  select.innerHTML = '<option value="">Escolha uma pauta</option>' + (app.dashboard.jobs || []).map(job => `<option value="${escapeHtml(job.id)}">${escapeHtml(job.topic.slice(0, 82))}</option>`).join('');
  if ((app.dashboard.jobs || []).some(job => job.id === current)) select.value = current;
}

function fillBrandForm(brand) {
  if (!brand?.style || $('#brand-form').dataset.initialized === 'yes') return;
  $('#brand-form [name="tone"]').value = brand.style.tone || '';
  $('#brand-form [name="pacing"]').value = brand.style.pacing || '';
  $('#brand-form').dataset.initialized = 'yes';
  $('#brand-rule-list').innerHTML = (brand.style.rules || []).map((rule, index) => `<div class="brand-rule"><b>${String(index + 1).padStart(2, '0')}</b><span>${escapeHtml(rule)}</span></div>`).join('');
  $('#forbidden-list').textContent = (brand.style.forbiddenWords || []).join(' · ');
}
async function saveBrand(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = $('button[type="submit"]', form);
  setBusy(button, true, 'Salvando…');
  try {
    await api('/api/brand', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tone: form.tone.value, pacing: form.pacing.value }) });
    $('#brand-saved').hidden = false;
    app.dashboard.brand.style.tone = form.tone.value;
    app.dashboard.brand.style.pacing = form.pacing.value;
    toast('Identidade editorial atualizada no arquivo local.');
  } catch (error) { toast(error.message, 'error'); }
  finally { setBusy(button, false); }
}

async function loadAnalytics() {
  try {
    const data = await api('/api/analytics');
    $('#metric-views').textContent = formatNumber(data.views);
    $('#metric-saves').textContent = formatNumber(data.saves);
    $('#metric-shares').textContent = formatNumber(data.shares);
    $('#metric-retention').textContent = `${Number(data.avgRetention || 0).toLocaleString('pt-BR')}%`;
    $('#stat-reach').textContent = formatNumber(data.views);
    $('#stat-reach-note').textContent = data.metricsCount ? `${data.metricsCount} registro(s) real(is)` : 'Aguardando métricas registradas';
    const rows = data.byPlatform || [];
    $('#platform-table').innerHTML = rows.length ? rows.map(row => `<tr><td>${escapeHtml(platformNames[row.platform] || row.platform)}</td><td>${formatNumber(row.posts)}</td><td>${formatNumber(row.views)}</td><td>${formatNumber(row.saves)}</td></tr>`).join('') : '<tr><td colspan="4" class="table-empty">Registre métricas para ver resultados.</td></tr>';
  } catch (error) { toast(error.message, 'error'); }
}
async function saveMetrics(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = $('button[type="submit"]', form);
  const payload = Object.fromEntries(new FormData(form).entries());
  setBusy(button, true, 'Salvando…');
  try {
    await api('/api/metrics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    await loadAnalytics();
    toast('Métricas adicionadas ao seu histórico local.');
    form.reset();
  } catch (error) { toast(error.message, 'error'); }
  finally { setBusy(button, false); }
}
async function createNewsletter() {
  const button = $('#make-newsletter');
  setBusy(button, true, 'Montando…');
  try {
    const data = await api('/api/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ creator: app.dashboard?.creator?.name || 'Kevin' }) });
    const result = $('#newsletter-result');
    result.hidden = false;
    result.innerHTML = `<span class="section-tag">RASCUNHO · SALVO LOCALMENTE</span><div class="panel-head"><h3>${escapeHtml(data.draft.subject)}</h3><a class="button button-outline" href="${escapeHtml(data.draft.downloadUrl)}" download>Baixar .md ↗</a></div><div class="result-note">Baseado nas métricas registradas para “${escapeHtml(data.draft.topPerformingTopic)}”. Revise e envie você mesmo.</div><div class="newsletter-body">${escapeHtml(data.draft.newsletterMarkdown)}</div>`;
    result.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast('Newsletter preparada como rascunho local.');
  } catch (error) { toast(error.message, 'error', 6500); }
  finally { setBusy(button, false); }
}

function chooseVideo(file) {
  if (!file) return;
  if (file.size > 300 * 1024 * 1024) { toast('O arquivo ultrapassa o limite local de 300 MB.', 'error'); return; }
  if (!/\.(mp4|mov|mkv|webm)$/i.test(file.name)) { toast('Envie um arquivo MP4, MOV, MKV ou WebM.', 'error'); return; }
  app.file = file;
  $('#uploaded-name').textContent = file.name;
  $('#uploaded-detail').textContent = `${(file.size / 1024 / 1024).toFixed(1)} MB · pronto para envio local`;
  $('#upload-check').textContent = '◷';
  $('#upload-video').disabled = false;
  $('#process-video').disabled = false;
  $('#video-notice').textContent = '';
}
async function uploadVideo() {
  if (!app.file) return;
  const button = $('#upload-video');
  setBusy(button, true, 'Enviando localmente…');
  try {
    const result = await api('/api/video/upload', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(app.file.name) }, body: app.file });
    app.uploadedName = result.name;
    $('#uploaded-detail').textContent = `${(result.bytes / 1024 / 1024).toFixed(1)} MB · salvo em inputs/raw_videos`;
    $('#upload-check').textContent = '✓';
    $('#upload-check').style.color = '#42885d';
    toast('Vídeo guardado no computador.');
  } catch (error) { toast(error.message, 'error'); }
  finally { setBusy(button, false); }
}
async function processVideo() {
  if (app.file && !app.uploadedName) await uploadVideo();
  if (!app.uploadedName) { toast('Envie um vídeo antes de iniciar a edição.', 'error'); return; }
  const button = $('#process-video');
  setBusy(button, true, 'Editando… pode levar alguns minutos');
  $('#video-notice').textContent = 'Processando o arquivo neste computador. Mantenha esta janela aberta.';
  try {
    const result = await api('/api/video/process', { method: 'POST', headers: { 'X-Video-Name': app.uploadedName } });
    const video = $('#video-result');
    video.hidden = false;
    $('#video-player').src = result.result.finalVideo;
    $('#video-download').href = result.result.finalVideo;
    $('#video-stats').innerHTML = `<strong>Duração original</strong><span>${Number(result.result.originalDuration).toFixed(1)} s</span><strong>Após os cortes</strong><span>${Number(result.result.finalDuration).toFixed(1)} s</span><strong>Tempo removido</strong><span>${Number(result.result.timeSavedSec).toFixed(1)} s</span><strong>Trechos silenciosos</strong><span>${formatNumber(result.result.silencesDetected)}</span><strong>Transcrição</strong><span>${result.captionsAvailable ? escapeHtml(result.result.transcriptText || 'Nenhuma fala reconhecida') : 'Requer GEMINI_API_KEY'}</span>`;
    $('#transcript-status').textContent = result.captionsAvailable ? 'ATIVO' : 'API';
    $('#video-notice').textContent = result.notice || 'Edição concluída. Confira o resultado antes de publicar.';
    video.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast(result.notice || 'Edição de vídeo concluída.');
  } catch (error) { $('#video-notice').textContent = ''; toast(error.message, 'error', 6500); }
  finally { setBusy(button, false); }
}

function renderPostizChannels(data) {
  app.postizIntegrations = data.integrations || [];
  const host = $('#postiz-channel-list');
  $('#postiz-count').textContent = String(app.postizIntegrations.length);
  $('#postiz-connect-form [name="apiUrl"]').value = data.apiUrl || 'https://api.postiz.com/public/v1';
  if (!data.configured) {
    $('#postiz-status').textContent = 'Ainda não conectado. Informe sua URL e chave da API Postiz.';
    host.innerHTML = '<div class="empty-state compact"><strong>Configure a chave para carregar seus canais.</strong></div>';
    return;
  }
  $('#postiz-status').textContent = `Conexão validada · ${app.postizIntegrations.length} canal(is) compatível(is).`;
  if (!app.postizIntegrations.length) {
    host.innerHTML = '<div class="empty-state compact"><strong>Nenhum canal compatível encontrado.</strong><span>Conecte os perfis desejados dentro do Postiz e atualize a lista.</span></div>';
    return;
  }
  host.innerHTML = app.postizIntegrations.map(channel => `<article class="postiz-channel-card ${channel.disabled ? 'is-disabled' : ''}"><span class="postiz-channel-mark">${escapeHtml((postizNames[channel.identifier] || 'Canal').slice(0, 1))}</span><div><strong>${escapeHtml(channel.name)}</strong><small>${escapeHtml(postizNames[channel.identifier] || channel.identifier)}${channel.profile ? ` · ${escapeHtml(channel.profile)}` : ''}</small></div><span class="postiz-channel-state">${channel.disabled ? 'Desativado' : 'Conectado'}</span></article>`).join('');
}

async function loadPostizChannels(showToast = false) {
  const status = $('#postiz-status');
  if (status) status.textContent = 'Consultando a conexão Postiz…';
  try {
    const data = await api('/api/postiz/integrations');
    renderPostizChannels(data);
    if (showToast) toast(data.configured ? `${data.integrations.length} canal(is) carregado(s).` : 'Configure a conexão Postiz primeiro.', data.configured ? 'success' : '');
    return data;
  } catch (error) {
    if (status) status.textContent = error.message;
    if (showToast) toast(error.message, 'error');
    return null;
  }
}

async function connectPostiz(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = $('button[type="submit"]', form);
  setBusy(button, true, 'Validando…');
  try {
    const data = await api('/api/postiz/connect', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiUrl: form.elements.apiUrl.value, apiKey: form.elements.apiKey.value })
    });
    form.elements.apiKey.value = '';
    renderPostizChannels(data);
    await reloadDashboard();
    toast(data.message);
  } catch (error) { toast(error.message, 'error', 6500); }
  finally { setBusy(button, false); }
}

function updateApprovalControls() {
  const selected = $$('.channel-check:checked', $('#approval-channel-list'));
  const hasTikTok = selected.some(input => input.dataset.platform === 'tiktok');
  const hasYoutube = selected.some(input => input.dataset.platform === 'youtube');
  const videoOptions = $('#approval-postiz-options');
  videoOptions.hidden = !hasTikTok && !hasYoutube;
  $('#tiktok-privacy-field').hidden = !hasTikTok;
  $('#tiktok-brand-content-field').hidden = !hasTikTok;
  $('#tiktok-brand-organic-field').hidden = !hasTikTok;
  $('#video-ai-field').hidden = !hasTikTok;
  $('#youtube-visibility-field').hidden = !hasYoutube;
  $('#youtube-kids-field').hidden = !hasYoutube;
  const needsKidsAnswer = hasYoutube && !$('#youtube-made-for-kids').value;
  $('#approval-confirm').disabled = selected.length === 0 || needsKidsAnswer;
}

function renderApprovalChannels(data) {
  const host = $('#approval-channel-list');
  app.approvalChannels = data.channels || [];
  if (!data.configured) {
    host.innerHTML = '<div class="approval-empty">Postiz ainda não está conectado. <button type="button" class="text-link" data-go="canais">Conectar canais</button></div>';
    $('#approval-confirm').disabled = true;
    return;
  }
  if (!app.approvalChannels.length) {
    host.innerHTML = '<div class="approval-empty">Nenhum perfil compatível está conectado no Postiz.</div>';
    $('#approval-confirm').disabled = true;
    return;
  }
  host.innerHTML = app.approvalChannels.map(channel => {
    const date = new Date(channel.scheduledTime).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const media = channel.mediaNames?.length ? channel.mediaNames.join(' · ') : channel.disabledReason;
    const checked = '';
    return `<article class="approval-channel-row ${channel.disabled ? 'is-disabled' : ''}"><label class="approval-channel-head"><input type="checkbox" class="channel-check" data-integration-id="${escapeHtml(channel.id)}" data-platform="${escapeHtml(channel.platform)}" ${checked} ${channel.disabled ? 'disabled' : ''}><span><strong>${escapeHtml(postizNames[channel.identifier] || channel.identifier)} · ${escapeHtml(channel.name)}</strong><small>${escapeHtml(channel.profile || 'Conta conectada no Postiz')}</small></span></label><div class="approval-channel-meta"><span>${escapeHtml(date)} · ${escapeHtml(data.timeZone || '')}</span><span>${escapeHtml(channel.mediaType)} · ${formatNumber(channel.mediaCount)} arquivo(s)</span></div><small class="approval-media-names">${escapeHtml(media || '')}</small>${channel.disabledReason ? `<small class="approval-disabled-reason">${escapeHtml(channel.disabledReason)}</small>` : `<label class="approval-caption-label">Texto exato da publicação<textarea class="channel-caption" data-channel-caption="${escapeHtml(channel.id)}" maxlength="5000" required>${escapeHtml(channel.caption || '')}</textarea></label>`}</article>`;
  }).join('');
  updateApprovalControls();
}

async function openApproval(jobId) {
  app.pendingApproval = jobId;
  $('#approval-topic').textContent = app.selectedJob?.topic || app.dashboard?.jobs?.find(job => job.id === jobId)?.topic || '';
  app.approvalChannels = [];
  $('#approval-channel-list').innerHTML = '<div class="approval-empty">Carregando contas conectadas…</div>';
  $('#approval-confirm').disabled = true;
  $('#approval-postiz-options').hidden = true;
  $('#tiktok-privacy').value = 'SELF_ONLY';
  $('#tiktok-brand-content').checked = false;
  $('#tiktok-brand-organic').checked = false;
  $('#video-made-with-ai').checked = false;
  $('#youtube-visibility').value = 'unlisted';
  $('#youtube-made-for-kids').value = '';
  $('#approval-dialog').showModal();
  try {
    const preview = await api(`/api/jobs/${encodeURIComponent(jobId)}/distribution-preview`);
    renderApprovalChannels(preview);
  } catch (error) {
    $('#approval-channel-list').innerHTML = `<div class="approval-empty">${escapeHtml(error.message)}</div>`;
    toast(`Não foi possível carregar os canais Postiz: ${error.message}`, 'error');
  }
}
async function approveJob() {
  const button = $('#approval-confirm');
  const selected = $$('.channel-check:checked', $('#approval-channel-list'));
  const targets = selected.map(input => {
    const channel = app.approvalChannels.find(item => item.id === input.dataset.integrationId);
    const caption = $$('.channel-caption', $('#approval-channel-list')).find(item => item.dataset.channelCaption === input.dataset.integrationId);
    return channel && caption ? { integrationId: channel.id, caption: caption.value, scheduledTime: channel.scheduledTime } : null;
  }).filter(Boolean);
  if (!targets.length) return toast('Selecione ao menos um canal disponível.', 'error');
  if (targets.some(target => !target.caption.trim())) return toast('Preencha o texto de cada canal selecionado.', 'error');
  const hasYoutube = targets.some(target => app.approvalChannels.find(channel => channel.id === target.integrationId)?.platform === 'youtube');
  if (hasYoutube && !$('#youtube-made-for-kids').value) return toast('Confirme a classificação de público do YouTube.', 'error');
  setBusy(button, true, 'Enviando ao Postiz…');
  try {
    const data = await api(`/api/jobs/${encodeURIComponent(app.pendingApproval)}/approve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targets,
        tiktokPrivacy: $('#tiktok-privacy').value,
        tiktokBrandContent: $('#tiktok-brand-content').checked,
        tiktokBrandOrganic: $('#tiktok-brand-organic').checked,
        videoMadeWithAI: $('#video-made-with-ai').checked,
        youtubeVisibility: $('#youtube-visibility').value,
        youtubeMadeForKids: $('#youtube-made-for-kids').value
      })
    });
    $('#approval-dialog').close();
    $('#content-dialog').close();
    await reloadDashboard();
    toast(data.message, data.partial ? 'error' : 'success', 8000);
    if (data.scheduled) showPage('conteudos');
  } catch (error) { toast(error.message, 'error'); }
  finally { setBusy(button, false); updateApprovalControls(); }
}
async function rejectJob(jobId) {
  if (!window.confirm('Marcar este rascunho como reprovado?')) return;
  try {
    await api(`/api/jobs/${encodeURIComponent(jobId)}/reject`, { method: 'POST' });
    $('#content-dialog').close();
    await reloadDashboard();
    toast('Conteúdo marcado como reprovado.');
  } catch (error) { toast(error.message, 'error'); }
}

function bindEvents() {
  $$('.nav-item').forEach(button => button.addEventListener('click', () => showPage(button.dataset.page)));
  document.addEventListener('click', event => {
    const go = event.target.closest('[data-go]');
    if (go) { event.preventDefault(); showPage(go.dataset.go); return; }
    const generate = event.target.closest('[data-generate]');
    if (generate) { generateContent(generate.dataset.generate, generate); return; }
    const open = event.target.closest('[data-open-job]');
    if (open) { openSavedJob(open.dataset.openJob); return; }
    const approve = event.target.closest('[data-approve]');
    if (approve) { openApproval(approve.dataset.approve); return; }
    const reject = event.target.closest('[data-reject]');
    if (reject) { rejectJob(reject.dataset.reject); return; }
  });
  $('#start-creation').addEventListener('click', () => showPage('radar'));
  $('#scan-trends').addEventListener('click', () => loadTrends(true));
  $('#refresh-button').addEventListener('click', refreshAll);
  $('#create-custom').addEventListener('click', event => generateContent($('#custom-topic').value, event.currentTarget));
  $('#custom-topic').addEventListener('keydown', event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) $('#create-custom').click(); });
  $('#brand-form').addEventListener('submit', saveBrand);
  $('#postiz-connect-form').addEventListener('submit', connectPostiz);
  $('#refresh-postiz').addEventListener('click', () => loadPostizChannels(true));
  $('#metric-form').addEventListener('submit', saveMetrics);
  $('#make-newsletter').addEventListener('click', createNewsletter);
  $('#choose-video').addEventListener('click', () => $('#video-file').click());
  $('#video-file').addEventListener('change', event => chooseVideo(event.target.files[0]));
  $('#upload-video').addEventListener('click', uploadVideo);
  $('#process-video').addEventListener('click', processVideo);
  const zone = $('#upload-zone');
  zone.addEventListener('dragover', event => { event.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', event => { event.preventDefault(); zone.classList.remove('dragover'); chooseVideo(event.dataTransfer.files[0]); });
  $('#approval-confirm').addEventListener('click', approveJob);
  $('#approval-channel-list').addEventListener('change', event => { if (event.target.matches('.channel-check')) updateApprovalControls(); });
  $('#approval-postiz-options').addEventListener('change', updateApprovalControls);
  $('#approval-cancel').addEventListener('click', () => $('#approval-dialog').close());
  $('#content-dialog').addEventListener('click', event => { if (event.target === $('#content-dialog')) $('#content-dialog').close(); });

  // MoneyPrinter Turbo Eventos Isolados
  const mptForm = $('#mpt-form');
  if (mptForm) mptForm.addEventListener('submit', handleMptSubmit);
  const mptRefresh = $('#mpt-refresh-history');
  if (mptRefresh) mptRefresh.addEventListener('click', () => loadMptTasks(true));
}

let mptPollInterval = null;

async function handleMptSubmit(event) {
  event.preventDefault();
  const subject = $('#mpt-subject').value.trim();
  const script = $('#mpt-script').value.trim();
  const orientation = $('#mpt-orientation').value;
  const voiceName = $('#mpt-voice').value;
  const pexelsApiKey = $('#mpt-pexels-key').value.trim();
  const btn = $('#mpt-submit-btn');

  if (!subject) return toast('Informe o tema do vídeo.', 'error');

  setBusy(btn, true, 'Disparando MoneyPrinter...');
  $('#mpt-status-box').hidden = false;
  $('#mpt-progress-fill').style.width = '10%';
  $('#mpt-status-label').textContent = 'Iniciando síntese de voz e roteiro...';
  $('#mpt-status-percent').textContent = '10%';

  try {
    const res = await api('/api/moneyprinter/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoSubject: subject,
        videoScript: script || undefined,
        videoOrientation: orientation,
        voiceName: voiceName,
        pexelsApiKey: pexelsApiKey || undefined,
      })
    });

    toast('Tarefa iniciada no MoneyPrinter Turbo!');
    startMptPolling(res.task.id);
  } catch (err) {
    setBusy(btn, false);
    $('#mpt-status-box').hidden = true;
    toast(err.message, 'error');
  }
}

function startMptPolling(taskId) {
  if (mptPollInterval) clearInterval(mptPollInterval);

  mptPollInterval = setInterval(async () => {
    try {
      const data = await api(`/api/moneyprinter/tasks/${encodeURIComponent(taskId)}`);
      const task = data.task;
      if (!task) return;

      const fill = $('#mpt-progress-fill');
      const label = $('#mpt-status-label');
      const pct = $('#mpt-status-percent');

      fill.style.width = `${task.progress}%`;
      pct.textContent = `${task.progress}%`;

      const statusLabels = {
        PENDING: 'Na fila...',
        GENERATING_SCRIPT: 'Gerando roteiro dinâmico...',
        SYNTHESIZING_VOICE: 'Sintetizando locução com Edge-TTS...',
        FETCHING_FOOTAGE: 'Obtendo imagens/cenas de fundo...',
        RENDERING: 'Compondo camadas e queimando legendas com FFmpeg...',
        COMPLETED: 'Vídeo concluído com sucesso!',
        FAILED: `Falha: ${task.error || 'Erro no processo'}`
      };

      label.textContent = statusLabels[task.status] || task.status;

      if (task.status === 'COMPLETED') {
        clearInterval(mptPollInterval);
        mptPollInterval = null;
        setBusy($('#mpt-submit-btn'), false);
        toast('Vídeo do MoneyPrinter Turbo pronto!');
        showMptPlayer(task);
        loadMptTasks();
      } else if (task.status === 'FAILED') {
        clearInterval(mptPollInterval);
        mptPollInterval = null;
        setBusy($('#mpt-submit-btn'), false);
        toast(task.error || 'Falha na renderização do vídeo.', 'error');
      }
    } catch (e) {
      console.error('[MPT Poll Error]', e);
    }
  }, 2000);
}

function showMptPlayer(task) {
  const player = $('#mpt-video-player');
  const empty = $('#mpt-player-empty');
  const dbox = $('#mpt-download-box');
  const dlink = $('#mpt-download-link');

  if (task.videoUrl) {
    player.src = task.videoUrl;
    player.hidden = false;
    empty.hidden = true;
    dlink.href = task.videoUrl;
    dbox.hidden = false;
  }
}

async function loadMptTasks(manual = false) {
  try {
    const res = await api('/api/moneyprinter/tasks');
    const container = $('#mpt-task-list');
    if (!res.tasks || res.tasks.length === 0) {
      container.innerHTML = `<div class="empty-state compact"><strong>Nenhum vídeo criado ainda no MoneyPrinter.</strong></div>`;
      return;
    }

    container.innerHTML = res.tasks.map(t => `
      <div class="mpt-task-card">
        <div class="mpt-task-icon">${t.status === 'COMPLETED' ? '▶' : '⏳'}</div>
        <div class="mpt-task-info">
          <strong>${escapeHtml(t.subject)}</strong>
          <small>${t.orientation === 'portrait' ? 'Vertical 9:16' : 'Horizontal 16:9'} · Voz: ${escapeHtml(t.voiceName)} · Status: ${escapeHtml(t.status)} (${t.progress}%)</small>
        </div>
        <div>
          ${t.videoUrl ? `<button class="button button-lime button-sm" onclick="showMptPlayer(${JSON.stringify(t).replace(/"/g, '&quot;')})">Assistir ↗</button>` : ''}
        </div>
      </div>
    `).join('');

    if (manual) toast('Histórico do MoneyPrinter atualizado.');
  } catch (err) {
    console.warn('[MPT] Erro ao carregar tarefas:', err);
  }
}

async function boot() {
  bindEvents();
  await Promise.all([reloadDashboard(), loadTrends()]);
}
boot();
