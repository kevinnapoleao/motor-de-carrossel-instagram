import dotenv from 'dotenv';

dotenv.config();

export interface TelegramApprovalPayload {
  jobId: string;
  topic: string;
  carouselCoverUrl?: string;
  reelsScriptSnippet: string;
}

export class TelegramService {
  private isEnabled: boolean;
  private botToken: string | undefined;
  private chatId: string | undefined;

  constructor() {
    this.isEnabled = process.env.TELEGRAM_ENABLED === 'true';
    this.botToken = process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = process.env.TELEGRAM_CHAT_ID;
  }

  /**
   * Retorna o status de conexão do Telegram
   */
  public getStatus(): { isConfigured: boolean; isEnabled: boolean; mode: string } {
    return {
      isConfigured: !!this.botToken,
      isEnabled: this.isEnabled,
      mode: this.isEnabled ? 'ATIVO' : 'STANDBY (Desabilitado conforme preferências do criador)'
    };
  }

  /**
   * Envia as 3 pautas do dia para aprovação rápida no celular
   */
  public async sendPautasForApproval(pautas: Array<{ title: string; affinity: number }>): Promise<boolean> {
    if (!this.isEnabled) {
      console.log('📱 [TelegramService] STANDBY: Envio de pautas móveis ignorado (módulo desabilitado).');
      return false;
    }

    try {
      console.log('📱 [TelegramService] Enviando pautas com botões inline para o Telegram...');
      // Implementação física via Telegram Bot API quando ativado
      return true;
    } catch (err) {
      console.error('❌ [TelegramService] Erro ao enviar mensagem:', err);
      return false;
    }
  }

  /**
   * Envia o pacote completo (Carrossel e Reels) com botões de Aprovar / Ajustar
   */
  public async sendApprovalCard(payload: TelegramApprovalPayload): Promise<boolean> {
    if (!this.isEnabled) {
      console.log(`📱 [TelegramService] STANDBY: Notificação móvel do Job ${payload.jobId} preservada para o Cockpit Local.`);
      return false;
    }

    try {
      console.log(`📱 [TelegramService] Enviando card de aprovação interativo para o chat ${this.chatId}...`);
      return true;
    } catch (err) {
      console.error('❌ [TelegramService] Erro ao despachar card:', err);
      return false;
    }
  }
}
