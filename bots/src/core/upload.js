export const MAX_FILE_BYTES = 2 * 1024 * 1024;
const NAME_RE = /\.(flickgame|html?|txt|json)$/i;

// The first attachment that could be a flickgame. `strict` is true for
// .flickgame files, where a parse failure deserves a ❌; other extensions
// fail silently because most .html/.txt uploads are not games.
export function pickGameAttachment(attachments) {
  for (const a of attachments) {
    const name = a.name || '';
    if (!NAME_RE.test(name)) continue;
    if (typeof a.size === 'number' && a.size > MAX_FILE_BYTES) continue;
    return { attachment: a, strict: /\.flickgame$/i.test(name) };
  }
  return null;
}

export async function fetchAttachmentText(attachment, fetchImpl = fetch) {
  const res = await fetchImpl(attachment.url);
  if (!res.ok) throw new Error(`attachment ${res.status}`);
  return res.text();
}
