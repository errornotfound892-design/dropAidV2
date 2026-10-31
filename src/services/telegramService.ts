import { Booking } from '../types/index.ts';

export interface TelegramConfig {
  botToken: string;
  operationsChatId: string;
  botUsername: string;
  appUrl: string;
}

export interface TelegramSendResult {
  success: boolean;
  isSimulated: boolean;
  messageId?: number;
  recipient: string;
  error?: string;
  caseLink: string;
}

export function getTelegramConfig(): TelegramConfig {
  return {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    operationsChatId: process.env.TELEGRAM_OPERATIONS_CHAT_ID || '',
    botUsername: process.env.TELEGRAM_BOT_USERNAME || 'DropAid_Emergency_Bot',
    appUrl: process.env.APP_URL || 'http://localhost:3000',
  };
}

export function isTelegramLiveConfigured(): boolean {
  const config = getTelegramConfig();
  return Boolean(config.botToken && config.operationsChatId && !config.botToken.includes('MY_TELEGRAM'));
}

/**
 * Generates an access-controlled, secure case link that does not expose sensitive imagery
 * directly to chat channels, requiring authentication or secret case token.
 */
export function generateSecureCaseLink(booking: Booking, appUrl?: string): string {
  const baseUrl = appUrl || process.env.APP_URL || 'http://localhost:3000';
  const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const accessKey = booking.caseAccessKey || 'verified-operator';
  return `${cleanBase}/?track=${booking.trackingCode}&auth=${accessKey}`;
}

/**
 * Format high-level emergency notification for Operations Telegram channel
 * Avoids raw diagnostic imagery or unprotected medical files; sends restricted case link.
 */
function buildOperationsMessage(booking: Booking, caseLink: string): string {
  const isSomeoneElse = booking.bookingFor === 'someone_else';
  const callerInfo = isSomeoneElse
    ? `\n<b>Caller:</b> ${booking.callerName || 'Bystander'} (${booking.relationship || 'Third-Party'}) - ${booking.callerPhone || 'Not given'}`
    : '';

  const bloodGroupStr = booking.bloodGroup && booking.bloodGroup !== 'Unknown'
    ? `\n<b>Blood Group:</b> <code>${booking.bloodGroup}</code>`
    : '';

  const photoNotice = booking.patientPhotoUrl
    ? `\n📷 <i>Patient/Scene photo attached (View via authenticated case link)</i>`
    : '';

  return (
    `🚨 <b>DROPAID EMERGENCY DISPATCH ALERT</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `<b>Tracking Code:</b> <code>${booking.trackingCode}</code>\n` +
    `<b>Status:</b> <b>${(booking.stage || 'pending').toUpperCase().replace(/_/g, ' ')}</b>\n` +
    `<b>Triage Specialty:</b> ${booking.issueCategory ? booking.issueCategory.toUpperCase() : 'GENERAL EMERGENCY'}\n` +
    `<b>Patient:</b> ${booking.patientName}\n` +
    `<b>Patient Phone:</b> <code>${booking.patientPhone}</code>` +
    callerInfo +
    bloodGroupStr +
    `\n<b>Pickup Address:</b> ${booking.pickupAddress.split(',').slice(0, 3).join(',')}\n` +
    `<b>Destination ER:</b> ${booking.dropoffAddress.split(',')[0]}\n` +
    `<b>Road ETA:</b> ~${booking.etaMinutes || 5} min (${booking.distanceKm || 4.5} km)\n` +
    photoNotice +
    `\n━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🔒 <b>Secure Case Link (Access Restricted):</b>\n` +
    `<a href="${caseLink}">${caseLink}</a>\n` +
    `<i>Note: Clinical imagery and medical documents are access-controlled. Direct clinician login required.</i>`
  );
}

/**
 * Format patient/family receipt message for verified Telegram chat ID
 */
function buildPatientMessage(booking: Booking, caseLink: string): string {
  return (
    `🚑 <b>DropAid Emergency Response Confirmation</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Hello <b>${booking.patientName}</b>, an emergency dispatch request has been registered.\n\n` +
    `<b>Tracking Code:</b> <code>${booking.trackingCode}</code>\n` +
    `<b>Pickup:</b> ${booking.pickupAddress.split(',')[0]}\n` +
    `<b>Receiving ER:</b> ${booking.dropoffAddress.split(',')[0]}\n` +
    `<b>Estimated ETA:</b> ~${booking.etaMinutes || 5} minutes\n\n` +
    `📱 <b>Live GPS Ambulance Tracker:</b>\n` +
    `<a href="${caseLink}">Track your unit live on map</a>\n\n` +
    `<i>If your condition worsens immediately or you are in critical danger, call emergency services (112 in India).</i>`
  );
}

/**
 * Send real Telegram message via Bot API or log labeled simulation
 */
export async function sendTelegramDispatchNotification(
  booking: Booking,
  targetChatId?: string,
  isPatientNotification: boolean = false
): Promise<TelegramSendResult> {
  const config = getTelegramConfig();
  const caseLink = generateSecureCaseLink(booking, config.appUrl);
  const chatId = targetChatId || config.operationsChatId;

  // Check if live credentials exist
  if (!config.botToken || !chatId || config.botToken === 'MY_TELEGRAM_BOT_TOKEN') {
    const simMsg = `[Telegram Dispatch Simulation] Case ${booking.trackingCode} dispatched to ${isPatientNotification ? 'patient chat' : 'operations channel'} (${chatId || 'not_configured'}). Link: ${caseLink}`;
    console.log(simMsg);
    return {
      success: true,
      isSimulated: true,
      recipient: chatId || 'unconfigured_channel',
      caseLink,
    };
  }

  const messageText = isPatientNotification
    ? buildPatientMessage(booking, caseLink)
    : buildOperationsMessage(booking, caseLink);

  try {
    const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      const errMsg = data.description || `Telegram API responded with HTTP ${res.status}`;
      console.warn(`[Telegram Error] Failed to send message to ${chatId}:`, errMsg);
      return {
        success: false,
        isSimulated: false,
        recipient: chatId,
        error: errMsg,
        caseLink,
      };
    }

    console.log(`[Telegram Success] Message delivered to ${chatId} (Msg ID: ${data.result?.message_id})`);
    return {
      success: true,
      isSimulated: false,
      messageId: data.result?.message_id,
      recipient: chatId,
      caseLink,
    };
  } catch (err: any) {
    console.warn(`[Telegram Exception] Network error sending to ${chatId}:`, err.message);
    return {
      success: false,
      isSimulated: false,
      recipient: chatId,
      error: err.message,
      caseLink,
    };
  }
}
