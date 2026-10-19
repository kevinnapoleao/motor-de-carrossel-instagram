import fs from 'node:fs/promises';
import path from 'node:path';

export type SocialPlatform = 'instagram' | 'tiktok' | 'youtube' | 'threads' | 'linkedin';
export type PostizIdentifier = SocialPlatform | 'instagram-standalone' | 'linkedin-page';

export interface PostizIntegration {
  id: string;
  name: string;
  identifier: PostizIdentifier;
  profile?: string;
  picture?: string;
  disabled: boolean;
}

export interface PostizMediaAsset {
  id: string;
  path: string;
}

export interface ScheduleOptions {
  tiktokTitle?: string;
  youtubeTitle?: string;
  youtubeVisibility?: 'public' | 'unlisted' | 'private';
  youtubeMadeForKids?: 'yes' | 'no';
  tiktokPrivacy?: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'FOLLOWER_OF_CREATOR' | 'SELF_ONLY';
  tiktokBrandContent?: boolean;
  tiktokBrandOrganic?: boolean;
  videoMadeWithAI?: boolean;
}

export interface PublishResult {
  integrationId: string;
  integrationName: string;
  platform: PostizIdentifier;
  status: 'SCHEDULED';
  postId?: string;
  scheduledTime: string;
  provider: 'postiz-api';
}

const DEFAULT_POSTIZ_API_URL = 'https://api.postiz.com/public/v1';
const SUPPORTED_IDENTIFIERS = new Set<PostizIdentifier>([
  'instagram', 'instagram-standalone', 'tiktok', 'youtube', 'threads', 'linkedin', 'linkedin-page'
]);
const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.mp4': 'video/mp4'
};

export function getBasePlatform(identifier: PostizIdentifier): SocialPlatform {
  if (identifier === 'instagram-standalone') return 'instagram';
  if (identifier === 'linkedin-page') return 'linkedin';
  return identifier;
}

export function isSupportedIntegration(value: unknown): value is PostizIntegration {
  if (!value || typeof value !== 'object') return false;
  const integration = value as Record<string, unknown>;
  return typeof integration.id === 'string' && integration.id.length > 0 &&
    typeof integration.name === 'string' && typeof integration.identifier === 'string' &&
    SUPPORTED_IDENTIFIERS.has(integration.identifier as PostizIdentifier);
}

function authError(status: number) {
  const message = status === 401 ? 'A chave do Postiz não foi aceita.' :
    status === 403 ? 'O Postiz recusou acesso a esta organização.' :
      `O Postiz respondeu com HTTP ${status}.`;
  return Object.assign(new Error(message), { statusCode: status === 401 || status === 403 ? 502 : status });
}

export function buildPostizScheduleBody(input: {
  channel: PostizIntegration;
  caption: string;
  scheduledTime: string;
  media: PostizMediaAsset[];
  options?: ScheduleOptions;
}) {
  if (!SUPPORTED_IDENTIFIERS.has(input.channel.identifier)) {
    throw Object.assign(new Error('Este tipo de canal Postiz ainda não é compatível.'), { statusCode: 400 });
  }
  if (!input.caption.trim()) throw Object.assign(new Error('O texto da publicação está vazio.'), { statusCode: 400 });
  if (Number.isNaN(Date.parse(input.scheduledTime)) || Date.parse(input.scheduledTime) <= Date.now()) {
    throw Object.assign(new Error('Escolha um horário futuro válido para o agendamento.'), { statusCode: 400 });
  }

  const identifier = input.channel.identifier;
  let settings: Record<string, unknown>;
  if (identifier === 'instagram' || identifier === 'instagram-standalone') {
    settings = { __type: identifier, post_type: 'post', is_trial_reel: false, collaborators: [] };
  } else if (identifier === 'linkedin' || identifier === 'linkedin-page') {
    settings = { __type: identifier, post_as_images_carousel: input.media.length > 1 };
  } else if (identifier === 'tiktok') {
    settings = {
      __type: 'tiktok', title: (input.options?.tiktokTitle || input.caption).slice(0, 90),
      privacy_level: input.options?.tiktokPrivacy || 'SELF_ONLY',
      duet: false, stitch: false, comment: true, autoAddMusic: 'no',
      brand_content_toggle: input.options?.tiktokBrandContent === true,
      brand_organic_toggle: input.options?.tiktokBrandOrganic === true,
      video_made_with_ai: input.options?.videoMadeWithAI === true,
      content_posting_method: 'DIRECT_POST'
    };
  } else if (identifier === 'youtube') {
    settings = {
      __type: 'youtube', title: (input.options?.youtubeTitle || input.channel.name).slice(0, 100) || 'Novo vídeo',
      type: input.options?.youtubeVisibility || 'unlisted',
      selfDeclaredMadeForKids: input.options?.youtubeMadeForKids || 'no', tags: []
    };
  } else {
    settings = { __type: 'threads' };
  }

  return {
    type: 'schedule' as const,
    date: input.scheduledTime,
    shortLink: false,
    tags: [],
    posts: [{
      integration: { id: input.channel.id },
      value: [{ content: input.caption.trim(), image: input.media }],
      settings
    }]
  };
}

export class SocialDistributionEngine {
  static getApiUrl(value = process.env.POSTIZ_API_URL): string {
    return String(value || DEFAULT_POSTIZ_API_URL).trim().replace(/\/+$/, '');
  }

  static getReferenceScheduleTime(platform: SocialPlatform): { scheduledTime: string; reason: string } {
    const now = new Date();
    const primeHours: Record<SocialPlatform, { hour: number; minute: number; reason: string }> = {
      instagram: { hour: 18, minute: 30, reason: 'Janela de referência à noite; ajuste quando houver dados do perfil' },
      linkedin: { hour: 8, minute: 45, reason: 'Janela de referência no início do expediente; ajuste conforme seus resultados' },
      tiktok: { hour: 20, minute: 15, reason: 'Janela de referência noturna; não calculada a partir do histórico da conta' },
      youtube: { hour: 19, minute: 0, reason: 'Janela de referência após as 19h; ajuste conforme seus resultados' },
      threads: { hour: 12, minute: 15, reason: 'Janela de referência perto do almoço; ajuste conforme seus resultados' }
    };
    const target = primeHours[platform];
    const scheduledDate = new Date(now);
    scheduledDate.setHours(target.hour, target.minute, 0, 0);
    if (scheduledDate.getTime() <= now.getTime()) scheduledDate.setDate(scheduledDate.getDate() + 1);
    return { scheduledTime: scheduledDate.toISOString(), reason: target.reason };
  }

  static async listIntegrations(apiUrl = this.getApiUrl(), apiKey = process.env.POSTIZ_API_KEY): Promise<PostizIntegration[]> {
    if (!apiKey) throw Object.assign(new Error('Configure sua chave da API Postiz antes de listar os canais.'), { statusCode: 409 });
    let response: Response;
    try {
      response = await fetch(`${apiUrl}/integrations`, {
        headers: { Authorization: apiKey, Accept: 'application/json' },
        signal: AbortSignal.timeout(15000)
      });
    } catch {
      throw Object.assign(new Error('Não foi possível alcançar o Postiz. Confira a URL da API e sua conexão.'), { statusCode: 502 });
    }
    if (!response.ok) throw authError(response.status);
    const data: unknown = await response.json().catch(() => null);
    if (!Array.isArray(data)) throw Object.assign(new Error('O Postiz retornou uma lista de canais inválida.'), { statusCode: 502 });
    return data.filter(isSupportedIntegration).map((item) => ({
      id: item.id,
      name: item.name,
      identifier: item.identifier,
      profile: typeof item.profile === 'string' ? item.profile : undefined,
      picture: typeof item.picture === 'string' ? item.picture : undefined,
      disabled: item.disabled === true
    }));
  }

  static async uploadMedia(filePath: string, apiUrl = this.getApiUrl(), apiKey = process.env.POSTIZ_API_KEY): Promise<PostizMediaAsset> {
    if (!apiKey) throw Object.assign(new Error('Configure sua chave da API Postiz antes de enviar mídia.'), { statusCode: 409 });
    const extension = path.extname(filePath).toLowerCase();
    const mimeType = MIME_BY_EXTENSION[extension];
    if (!mimeType) throw Object.assign(new Error(`Formato de mídia não aceito pelo Postiz: ${extension || 'sem extensão'}.`), { statusCode: 400 });
    const file = await fs.readFile(filePath);
    if (file.byteLength > 49 * 1024 * 1024) {
      throw Object.assign(new Error('A mídia excede o limite seguro de 49 MB para upload via Postiz.'), { statusCode: 413 });
    }
    const form = new FormData();
    form.append('file', new Blob([file], { type: mimeType }), path.basename(filePath));
    let response: Response;
    try {
      response = await fetch(`${apiUrl}/upload`, {
        method: 'POST',
        headers: { Authorization: apiKey },
        body: form,
        signal: AbortSignal.timeout(60000)
      });
    } catch {
      throw Object.assign(new Error('Falha ao enviar mídia ao Postiz. Confira a conexão e tente novamente.'), { statusCode: 502 });
    }
    if (!response.ok) throw authError(response.status);
    const data = await response.json().catch(() => null) as Partial<PostizMediaAsset> | null;
    if (!data || typeof data.id !== 'string' || typeof data.path !== 'string') {
      throw Object.assign(new Error('O Postiz não retornou o identificador e o caminho da mídia enviados.'), { statusCode: 502 });
    }
    return { id: data.id, path: data.path };
  }

  static async createScheduledPost(input: {
    approved: boolean;
    channel: PostizIntegration;
    caption: string;
    scheduledTime: string;
    media: PostizMediaAsset[];
    options?: ScheduleOptions;
  }, apiUrl = this.getApiUrl(), apiKey = process.env.POSTIZ_API_KEY): Promise<PublishResult> {
    if (input.approved !== true) {
      throw Object.assign(new Error('Agendamento bloqueado: confirme a publicação no Cockpit.'), { statusCode: 403 });
    }
    if (!apiKey) throw Object.assign(new Error('A integração Postiz ainda não foi configurada.'), { statusCode: 409 });
    const body = buildPostizScheduleBody(input);
    let response: Response;
    try {
      response = await fetch(`${apiUrl}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: apiKey, Accept: 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000)
      });
    } catch {
      throw Object.assign(new Error('Não foi possível enviar o agendamento ao Postiz.'), { statusCode: 502 });
    }
    if (!response.ok) throw authError(response.status);
    const data = await response.json().catch(() => ({})) as Record<string, any>;
    return {
      integrationId: input.channel.id,
      integrationName: input.channel.name,
      platform: input.channel.identifier,
      status: 'SCHEDULED',
      postId: typeof data.id === 'string' ? data.id : undefined,
      scheduledTime: input.scheduledTime,
      provider: 'postiz-api'
    };
  }
}
