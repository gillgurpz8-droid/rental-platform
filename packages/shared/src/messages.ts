import { z } from 'zod';

export const MESSAGE_MAX_LENGTH = 4000;

export const messageBodySchema = z
  .string()
  .trim()
  .max(MESSAGE_MAX_LENGTH, `Messages can be up to ${MESSAGE_MAX_LENGTH} characters`);

export const ATTACHMENT_BUCKET = 'message-attachments';

/**
 * Storage path for a message attachment. The first folder must be the
 * conversation id: the storage policies check it to decide who can read it.
 */
export function attachmentPath(conversationId: string, fileName: string, uniqueId: string): string {
  const extension = /\.([a-z0-9]{1,5})$/i.exec(fileName)?.[1]?.toLowerCase() ?? 'jpg';
  return `${conversationId}/${uniqueId}.${extension}`;
}

/**
 * Short timestamp for message lists: the time for today, the weekday within
 * the last week, otherwise the date.
 */
export function formatMessageTime(iso: string, now: Date = new Date(), locale = 'en-US', timeZone?: string): string {
  const date = new Date(iso);
  const dayKey = (d: Date) => d.toLocaleDateString('en-CA', { timeZone });
  const daysAgo = Math.round((Date.parse(dayKey(now)) - Date.parse(dayKey(date))) / 86_400_000);
  if (daysAgo === 0) return date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', timeZone });
  if (daysAgo > 0 && daysAgo < 7) return date.toLocaleDateString(locale, { weekday: 'short', timeZone });
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric', timeZone });
}
