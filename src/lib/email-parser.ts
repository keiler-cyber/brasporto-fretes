import { simpleParser } from 'mailparser';
import * as MsgParser from 'msg-parser';

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
    to: parsed.to?.text,
    subject: parsed.subject,
    text: parsed.text,
    html: parsed.html,
    attachments,
  };
}

/**
 * Processa arquivo MSG (Outlook) e extrai conteúdo + anexos
 */
export async function parseMSG(buffer: Buffer): Promise<ParsedEmail> {
  try {
    const msg = await MsgParser.default(buffer);
    
    const attachments = [];
    if (msg.attachments && Array.isArray(msg.attachments)) {
      for (const att of msg.attachments) {
        attachments.push({
          filename: att.filename || 'attachment',
          content: att.content || Buffer.alloc(0),
          contentType: att.contentType || 'application/octet-stream',
        });
      }
    }

    return {
      from: msg.senderName || msg.senderEmail,
      to: msg.recipientName || msg.recipientEmail,
      subject: msg.subject,
      text: msg.textBody,
      html: msg.htmlBody,
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
