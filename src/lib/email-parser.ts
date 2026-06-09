import { simpleParser } from 'mailparser';
import MsgReader from '@kenjiuno/msgreader';

export interface ParsedEmail {
  from?: string;
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
  attachments: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
}

/**
 * Processa arquivo EML e extrai conteúdo + anexos
 */
export async function parseEML(buffer: Buffer): Promise<ParsedEmail> {
  const parsed = await simpleParser(buffer);
  
  const attachments = [];
  if (parsed.attachments) {
    for (const att of parsed.attachments) {
      attachments.push({
        filename: att.filename || 'attachment',
        content: att.content as Buffer,
        contentType: att.contentType || 'application/octet-stream',
      });
    }
  }

  return {
    from: parsed.from?.text,
    to: Array.isArray(parsed.to) ? parsed.to[0]?.text : parsed.to?.text,
    subject: parsed.subject,
    text: parsed.text,
    html: parsed.html || undefined,
    attachments,
  };
}

/**
 * Processa arquivo MSG (Outlook) e extrai conteúdo + anexos
 */
export async function parseMSG(buffer: Buffer): Promise<ParsedEmail> {
  try {
    const reader = new MsgReader(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);
    const msg = reader.getFileData();

    const attachments = [];
    if (msg.attachments && Array.isArray(msg.attachments)) {
      for (const att of msg.attachments) {
        const attData = reader.getAttachment(att);
        attachments.push({
          filename: att.fileName || att.name || 'attachment',
          content: Buffer.from(attData.content as Uint8Array),
          contentType: 'application/octet-stream',
        });
      }
    }

    return {
      from: msg.senderName || msg.senderEmail,
      to: msg.recipients?.[0]?.name || msg.recipients?.[0]?.email,
      subject: msg.subject,
      text: msg.body,
      html: undefined,
      attachments,
    };
  } catch (error) {
    console.error('Erro ao processar MSG:', error);
    throw new Error('Erro ao processar arquivo MSG');
  }
}

/**
 * Extrai PDFs de anexos de email ou retorna o corpo do email como texto
 */
export async function extractContentFromEmail(parsedEmail: ParsedEmail): Promise<{
  pdfAttachments: Array<{ filename: string; buffer: Buffer }>;
  textContent: string;
}> {
  const pdfAttachments = parsedEmail.attachments
    .filter((att) => att.contentType.includes('pdf'))
    .map((att) => ({ filename: att.filename, buffer: att.content }));

  // Se não houver PDF, usar o conteúdo do email (texto ou HTML)
  const textContent = parsedEmail.text || parsedEmail.html || '';

  return {
    pdfAttachments,
    textContent,
  };
}
