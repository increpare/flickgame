import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Maps a short id (fits in callback data) to a Telegram file_id, persisted
// as JSON so uploaded games keep working across restarts.
export class UploadStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.map = new Map();
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      for (const [id, rec] of Object.entries(raw)) this.map.set(id, rec);
    } catch {
      // first run, or unreadable file: start empty
    }
  }

  static shortId(fileId) {
    return crypto.createHash('sha1').update(String(fileId)).digest('hex').slice(0, 10);
  }

  add(fileId, name) {
    const id = UploadStore.shortId(fileId);
    if (!this.map.has(id)) {
      this.map.set(id, { fileId, name: String(name || '') });
      this.save();
    }
    return id;
  }

  get(id) {
    return this.map.get(id) || null;
  }

  save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(this.map), null, 1));
    fs.renameSync(tmp, this.filePath);
  }
}
