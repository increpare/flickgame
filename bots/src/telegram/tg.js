// Minimal Telegram Bot API client on Node's fetch/FormData. No dependencies.
export class TelegramApi {
  constructor(token, fetchImpl = fetch) {
    this.base = `https://api.telegram.org/bot${token}`;
    this.fileBase = `https://api.telegram.org/file/bot${token}`;
    this.fetch = fetchImpl;
  }

  // files: { fieldName: { buffer, filename, type? } } -> multipart upload.
  async call(method, params = {}, files = {}) {
    const url = `${this.base}/${method}`;
    let res;
    if (Object.keys(files).length) {
      const form = new FormData();
      for (const [k, v] of Object.entries(params)) {
        if (v === undefined) continue;
        form.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
      }
      for (const [k, f] of Object.entries(files)) {
        form.append(k, new Blob([f.buffer], { type: f.type || 'image/png' }), f.filename);
      }
      res = await this.fetch(url, { method: 'POST', body: form });
    } else {
      res = await this.fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(params),
      });
    }
    const data = await res.json();
    if (!data.ok) {
      const err = new Error(`${method}: ${data.description || `HTTP ${res.status}`}`);
      err.code = data.error_code;
      err.retryAfter = data.parameters?.retry_after;
      throw err;
    }
    return data.result;
  }

  async downloadFileText(fileId) {
    const file = await this.call('getFile', { file_id: fileId });
    const res = await this.fetch(`${this.fileBase}/${file.file_path}`);
    if (!res.ok) throw new Error(`file download ${res.status}`);
    return res.text();
  }
}
