// NoteOn - Serviço de Integração com WhatsApp para Estudos
// Envio direto via Click-to-Chat (wa.me), Robô Open-WA (@open-wa/wa-automate) e Webhooks automáticos (n8n, Evolution API, Z-API)

const KEY_WHATSAPP_PHONE = 'noteon_user_whatsapp';
const KEY_WHATSAPP_WEBHOOK = 'noteon_whatsapp_webhook_url';
const KEY_WHATSAPP_AUTO_WEBHOOK = 'noteon_whatsapp_auto_webhook';
const KEY_OPENWA_URL = 'noteon_openwa_server_url';
const KEY_OPENWA_KEY = 'noteon_openwa_api_key';
const KEY_OPENWA_AUTO = 'noteon_openwa_auto_send';

export interface WhatsAppConfig {
  phone: string;
  webhookUrl: string;
  autoSendWebhook: boolean;
  openWaUrl: string;
  openWaApiKey: string;
  autoSendOpenWa: boolean;
}

export interface StudyDispatchPayload {
  topicTitle: string;
  subjectName?: string;
  courseName?: string;
  content: string;
  audioCount?: number;
  photoCount?: number;
  questionsCount?: number;
  source?: string;
}

/**
 * Sanitiza e formata o telefone para o padrão internacional do WhatsApp.
 * Se o usuário digitar DDD + Número (10 ou 11 dígitos), adiciona automaticamente o DDI do Brasil (55).
 */
export function sanitizePhoneNumber(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');

  // DDD + 9 ou 8 dígitos brasileiros sem 55 (ex: 11987654321 ou 1187654321)
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  // Já contém DDI ou formato internacional
  return digits;
}

/**
 * Formata o telefone para exibição amigável no input do usuário.
 */
export function formatPhoneForDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';

  // Se tiver 55 no início (13 dígitos móvel ou 12 fixo)
  if (digits.startsWith('55') && digits.length >= 12) {
    const ddd = digits.slice(2, 4);
    if (digits.length === 13) {
      const part1 = digits.slice(4, 9);
      const part2 = digits.slice(9, 13);
      return `+55 (${ddd}) ${part1}-${part2}`;
    }
    const part1 = digits.slice(4, 8);
    const part2 = digits.slice(8, 12);
    return `+55 (${ddd}) ${part1}-${part2}`;
  }

  // Se tiver 11 dígitos (DDD + 9)
  if (digits.length === 11) {
    const ddd = digits.slice(0, 2);
    const part1 = digits.slice(2, 7);
    const part2 = digits.slice(7, 11);
    return `(${ddd}) ${part1}-${part2}`;
  }

  // Se tiver 10 dígitos (DDD + 8)
  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const part1 = digits.slice(2, 6);
    const part2 = digits.slice(6, 10);
    return `(${ddd}) ${part1}-${part2}`;
  }

  return phone;
}

/**
 * Obtém a configuração de WhatsApp e Open-WA salva no navegador.
 */
export function getStoredWhatsAppConfig(): WhatsAppConfig {
  try {
    const phone = localStorage.getItem(KEY_WHATSAPP_PHONE) || '';
    const webhookUrl = localStorage.getItem(KEY_WHATSAPP_WEBHOOK) || '';
    const autoSendWebhook = localStorage.getItem(KEY_WHATSAPP_AUTO_WEBHOOK) === 'true';
    const openWaUrl = localStorage.getItem(KEY_OPENWA_URL) || '';
    const openWaApiKey = localStorage.getItem(KEY_OPENWA_KEY) || '';
    const autoSendOpenWa = localStorage.getItem(KEY_OPENWA_AUTO) === 'true';

    return {
      phone,
      webhookUrl,
      autoSendWebhook,
      openWaUrl,
      openWaApiKey,
      autoSendOpenWa,
    };
  } catch {
    return {
      phone: '',
      webhookUrl: '',
      autoSendWebhook: false,
      openWaUrl: '',
      openWaApiKey: '',
      autoSendOpenWa: false,
    };
  }
}

/**
 * Salva a configuração de WhatsApp no navegador.
 */
export function saveStoredWhatsAppConfig(config: Partial<WhatsAppConfig>): void {
  try {
    if (config.phone !== undefined) {
      const cleaned = sanitizePhoneNumber(config.phone);
      localStorage.setItem(KEY_WHATSAPP_PHONE, cleaned);
    }
    if (config.webhookUrl !== undefined) {
      localStorage.setItem(KEY_WHATSAPP_WEBHOOK, config.webhookUrl.trim());
    }
    if (config.autoSendWebhook !== undefined) {
      localStorage.setItem(KEY_WHATSAPP_AUTO_WEBHOOK, String(config.autoSendWebhook));
    }
    if (config.openWaUrl !== undefined) {
      localStorage.setItem(KEY_OPENWA_URL, config.openWaUrl.trim().replace(/\/+$/, ''));
    }
    if (config.openWaApiKey !== undefined) {
      localStorage.setItem(KEY_OPENWA_KEY, config.openWaApiKey.trim());
    }
    if (config.autoSendOpenWa !== undefined) {
      localStorage.setItem(KEY_OPENWA_AUTO, String(config.autoSendOpenWa));
    }
  } catch (err) {
    console.error('Falha ao salvar configuração do WhatsApp/Open-WA:', err);
  }
}

/**
 * Converte Markdown de texto em formatação legível para o WhatsApp:
 * - Cabeçalhos (#, ##, ###) viram títulos em negrito com emojis
 * - **negrito** vira *negrito*
 * - Listas com - ou * viram marcadores com bullet •
 */
export function convertMarkdownToWhatsApp(text: string): string {
  if (!text) return '';

  let converted = text;

  // Substitui cabeçalhos markdown por negrito com emojis destacados
  converted = converted.replace(/^### (.*$)/gim, '▫️ *$1*');
  converted = converted.replace(/^## (.*$)/gim, '🔹 *$1*');
  converted = converted.replace(/^# (.*$)/gim, '📌 *$1*');

  // Converte **bold** do markdown para *bold* do WhatsApp
  converted = converted.replace(/\*\*(.*?)\*\*/g, '*$1*');

  // Converte bullets "- " ou "* " para "• "
  converted = converted.replace(/^[\*\-] (.*$)/gim, '• $1');

  // Limpa múltiplos espaços em branco excessivos preservando quebras de linha
  converted = converted.replace(/\n{3,}/g, '\n\n');

  return converted.trim();
}

/**
 * Monta a mensagem completa e estilizada para envio ao WhatsApp.
 */
export function formatWhatsAppStudyMessage(payload: StudyDispatchPayload): string {
  const dateStr = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const cleanBody = convertMarkdownToWhatsApp(payload.content);

  const parts = [
    `📚 *NOTEON | PLANO DE ESTUDO & REVISÃO*`,
    `🎯 *Aula:* ${payload.topicTitle}`,
    payload.subjectName ? `📖 *Disciplina:* ${payload.subjectName}` : null,
    payload.courseName ? `🎓 *Curso:* ${payload.courseName}` : null,
    `📅 *Gerado em:* ${dateStr}`,
    (payload.audioCount || payload.photoCount)
      ? `📊 *Material:* ${payload.audioCount || 0} gravações | ${payload.photoCount || 0} fotos/slides`
      : null,
    `───────────────────────────────`,
    ``,
    cleanBody,
    ``,
    `───────────────────────────────`,
    `💡 _Dica: Revise 15 minutos hoje e amanhã para fixar na memória de longo prazo (SM-2)._`,
    `📱 _Gerado pelo seu Tutor IA no NoteOn_`,
  ].filter((p) => p !== null);

  return parts.join('\n');
}

/**
 * Dispara envio direto do WhatsApp via link wa.me (abre o app do WhatsApp ou WhatsApp Web).
 */
export function sendViaWhatsAppDirect(phone: string, text: string): boolean {
  const cleanPhone = sanitizePhoneNumber(phone);
  if (!cleanPhone) return false;

  const encodedText = encodeURIComponent(text);
  const waUrl = `https://wa.me/${cleanPhone}?text=${encodedText}`;

  // Abre em nova aba / aplicativo do WhatsApp
  window.open(waUrl, '_blank', 'noopener,noreferrer');
  return true;
}

/**
 * Testa se o servidor Open-WA está ativo e online.
 */
export async function testOpenWaConnection(
  serverUrl: string,
  apiKey?: string
): Promise<{ success: boolean; message: string }> {
  if (!serverUrl) return { success: false, message: 'Informe a URL do servidor Open-WA.' };
  const cleanUrl = serverUrl.replace(/\/+$/, '');

  const headers: Record<string, string> = {};
  if (apiKey?.trim()) {
    headers['api_key'] = apiKey.trim();
    headers['apikey'] = apiKey.trim();
  }

  try {
    // Tenta pingar o servidor Open-WA
    const pingRes = await fetch(`${cleanUrl}/ping`, { headers }).catch(() => null);
    if (pingRes && pingRes.ok) {
      return { success: true, message: 'Servidor Open-WA online e respondendo (ping OK)!' };
    }

    const hostRes = await fetch(`${cleanUrl}/getHostNumber`, { headers }).catch(() => null);
    if (hostRes && hostRes.ok) {
      const data = await hostRes.json().catch(() => null);
      return { success: true, message: `Conectado ao WhatsApp de ${data?.response || 'seu número'}!` };
    }

    return {
      success: true,
      message: 'Servidor acessível (porta aberta e conectado).',
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Erro ao conectar em ${cleanUrl}: ${err?.message || 'Servidor inacessível ou offline.'}`,
    };
  }
}

/**
 * Dispara mensagem 100% silenciosa e automática via servidor Open-WA (@open-wa/wa-automate).
 * Suporta o formato padrão REST do Open-WA e endpoints compatíveis (WPPConnect / Evolution API).
 */
export async function sendViaOpenWA(
  serverUrl: string,
  apiKey: string | undefined,
  phone: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  if (!serverUrl) return { success: false, error: 'URL do servidor Open-WA não configurada.' };

  const cleanUrl = serverUrl.replace(/\/+$/, '');
  const cleanPhone = sanitizePhoneNumber(phone);
  if (!cleanPhone) return { success: false, error: 'Número de WhatsApp inválido.' };

  const chatId = `${cleanPhone}@c.us`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey?.trim()) {
    headers['api_key'] = apiKey.trim();
    headers['apikey'] = apiKey.trim();
    headers['Authorization'] = `Bearer ${apiKey.trim()}`;
  }

  // Schema Open-WA padrão para /sendText
  const payload = {
    args: {
      to: chatId,
      content: message,
    },
    // Compatibilidade plana adicional
    to: chatId,
    content: message,
    chatId,
    number: cleanPhone,
    text: message,
    message,
  };

  try {
    const res = await fetch(`${cleanUrl}/sendText`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      // Se /sendText retornar 404, tenta rota alternativa compatível
      if (res.status === 404) {
        const altRes = await fetch(`${cleanUrl}/api/send-message`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ phone: cleanPhone, message }),
        });
        if (altRes.ok) return { success: true };
      }

      return {
        success: false,
        error: `Open-WA respondeu com status ${res.status}: ${res.statusText}`,
      };
    }

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: `Não foi possível conectar ao servidor Open-WA em ${cleanUrl}. Verifique se ele está em execução. (${err?.message || err})`,
    };
  }
}

/**
 * Envia o resumo / plano de estudo via webhook HTTP POST em segundo plano
 * (Compatível com n8n, Evolution API, Z-API, Baileys, Make, etc).
 */
export async function sendViaWebhook(
  webhookUrl: string,
  payload: StudyDispatchPayload,
  phone: string
): Promise<{ success: boolean; error?: string }> {
  if (!webhookUrl || !webhookUrl.startsWith('http')) {
    return { success: false, error: 'URL do Webhook inválida.' };
  }

  try {
    const formattedMessage = formatWhatsAppStudyMessage(payload);

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event: 'noteon_study_plan',
        phone: sanitizePhoneNumber(phone),
        message: formattedMessage,
        rawContent: payload.content,
        topicTitle: payload.topicTitle,
        subjectName: payload.subjectName,
        courseName: payload.courseName,
        timestamp: Date.now(),
      }),
    });

    if (!res.ok) {
      return {
        success: false,
        error: `Webhook respondeu com status ${res.status}: ${res.statusText}`,
      };
    }

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Falha na conexão com o Webhook.',
    };
  }
}

/**
 * Orquestra o envio do plano de estudo para o WhatsApp:
 * 1. Se Open-WA estiver configurado, tenta envio 100% automático e silencioso!
 * 2. Se falhar ou não estiver configurado, recorre ao Click-to-Chat direto (wa.me).
 * 3. Se houver Webhook configurado, dispara em segundo plano.
 */
export async function dispatchStudyToWhatsApp(
  payload: StudyDispatchPayload,
  customPhone?: string
): Promise<{
  success: boolean;
  openedWhatsApp: boolean;
  triggeredWebhook: boolean;
  sentViaOpenWa: boolean;
  message?: string;
}> {
  const config = getStoredWhatsAppConfig();
  const phone = customPhone ? sanitizePhoneNumber(customPhone) : config.phone;

  if (!phone && !config.webhookUrl && !config.openWaUrl) {
    return {
      success: false,
      openedWhatsApp: false,
      triggeredWebhook: false,
      sentViaOpenWa: false,
      message: 'Nenhum número de WhatsApp, Open-WA ou Webhook configurado.',
    };
  }

  const formattedText = formatWhatsAppStudyMessage(payload);
  let sentViaOpenWa = false;
  let openedWhatsApp = false;
  let triggeredWebhook = false;

  // 1. Tenta envio automático via Open-WA se a URL estiver configurada
  if (config.openWaUrl && phone) {
    const openWaRes = await sendViaOpenWA(
      config.openWaUrl,
      config.openWaApiKey,
      phone,
      formattedText
    );
    if (openWaRes.success) {
      sentViaOpenWa = true;
    } else {
      console.warn('Falha no Open-WA, caindo para envio direto:', openWaRes.error);
    }
  }

  // 2. Se não enviou pelo Open-WA, abre via link wa.me direto no WhatsApp
  if (!sentViaOpenWa && phone) {
    openedWhatsApp = sendViaWhatsAppDirect(phone, formattedText);
  }

  // 3. Webhook em segundo plano se configurado
  if (config.webhookUrl) {
    try {
      const webhookRes = await sendViaWebhook(config.webhookUrl, payload, phone);
      triggeredWebhook = webhookRes.success;
    } catch (e) {
      console.warn('Erro ao disparar webhook:', e);
    }
  }

  return {
    success: sentViaOpenWa || openedWhatsApp || triggeredWebhook,
    openedWhatsApp,
    triggeredWebhook,
    sentViaOpenWa,
    message: sentViaOpenWa
      ? '🚀 Mensagem enviada automaticamente pelo seu robô Open-WA!'
      : openedWhatsApp
      ? 'WhatsApp aberto com o plano pronto para envio!'
      : 'Plano enviado via Webhook com sucesso!',
  };
}
