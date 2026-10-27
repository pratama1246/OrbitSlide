import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';
import initSqlJs, { Database as SqlDatabase } from 'sql.js';
import { WebsiteSlide, AppSettings } from '../types';

export function detectSystemLanguage(): 'id' | 'en' {
  try {
    if (app.getLocaleCountryCode?.()?.toUpperCase() === 'ID') return 'id';
    const loc = (app.getSystemLocale?.() || app.getLocale?.() || '').toLowerCase();
    if (loc.startsWith('id')) return 'id';
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz === 'Asia/Jakarta' || tz === 'Asia/Makassar' || tz === 'Asia/Jayapura' || tz === 'Asia/Pontianak') {
      return 'id';
    }
  } catch {}
  return 'en';
}

export class ConfigDatabase {
  private db: SqlDatabase | null = null;
  private dbPath: string;
  private isPersisting = false;
  private pendingPersist = false;

  constructor() {
    const userDataDir = app.getPath('userData');
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }
    this.dbPath = path.join(userDataDir, 'orbitslide.db');
  }

  async init(): Promise<void> {
    const sqlInit = typeof initSqlJs === 'function' ? initSqlJs : (initSqlJs as unknown as { default: typeof initSqlJs }).default;
    const SQL = await sqlInit({
      locateFile: (file: string) => {
        if (app.isPackaged) {
          return path.join(process.resourcesPath, file);
        }
        const localDistPath = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file);
        if (fs.existsSync(localDistPath)) {
          return localDistPath;
        }
        return file;
      }
    });

    if (fs.existsSync(this.dbPath)) {
      const fileBuffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(fileBuffer);
    } else {
      this.db = new SQL.Database();
    }

    this.runMigrations();
    this.persist();
  }

  private runMigrations(): void {
    if (!this.db) return;

    this.db.run(`
      CREATE TABLE IF NOT EXISTS websites (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        duration INTEGER NOT NULL DEFAULT 15,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        keep_alive INTEGER NOT NULL DEFAULT 0,
        session_profile TEXT NOT NULL DEFAULT 'default',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    const langCheckStmt = this.db.prepare("SELECT value FROM settings WHERE key = 'language'");
    const hasSavedLang = langCheckStmt.step();
    const savedLangVal = hasSavedLang ? String(langCheckStmt.getAsObject().value) : null;
    langCheckStmt.free();

    const effectiveLang = (savedLangVal === 'id' || savedLangVal === 'en')
      ? savedLangVal
      : detectSystemLanguage();
    const defaultStandbyTitle = effectiveLang === 'id' ? 'Layar Standby' : 'Standby Screen';

    const checkStmt = this.db.prepare('SELECT id FROM websites WHERE id = ?');
    checkStmt.bind(['system-standby']);
    const hasStandby = checkStmt.step();
    checkStmt.free();

    if (!hasStandby) {
      const now = new Date().toISOString();
      this.db.run(
        `INSERT INTO websites (id, name, url, duration, sort_order, is_active, keep_alive, session_profile, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'system-standby',
          defaultStandbyTitle,
          'local://standby?preset=solid',
          15,
          0,
          1,
          0,
          'default',
          now,
          now
        ]
      );
    } else {
      this.db.run(
        `UPDATE websites SET url = 'local://standby?preset=solid'
         WHERE id = 'system-standby' AND url IN ('local://standby', 'local://standby?preset=mountains', 'local://standby?preset=ocean', 'local://standby?preset=forest')`
      );
      this.db.run(
        `UPDATE websites SET name = ?
         WHERE id = 'system-standby' AND name IN ('Layar Standby (Lock Screen)', 'Layar Standby', 'Standby Screen')`,
        [defaultStandbyTitle]
      );
    }

    const durStmt = this.db.prepare("SELECT value FROM settings WHERE key = 'default_duration'");
    if (durStmt.step()) {
      const globalDur = parseInt(String(durStmt.getAsObject().value), 10);
      if (globalDur >= 3) {
        this.db.run('UPDATE websites SET duration = ?', [globalDur]);
      }
    }
    durStmt.free();

    this.db.run('UPDATE websites SET keep_alive = 1');
  }

  private async persist(): Promise<void> {
    if (!this.db) return;
    if (this.isPersisting) {
      this.pendingPersist = true;
      return;
    }
    this.isPersisting = true;
    try {
      const data = this.db.export();
      await fs.promises.writeFile(this.dbPath, Buffer.from(data));
    } catch (err) {
      console.error('Failed to persist database:', err);
    } finally {
      this.isPersisting = false;
      if (this.pendingPersist) {
        this.pendingPersist = false;
        this.persist();
      }
    }
  }

  getWebsites(): WebsiteSlide[] {
    if (!this.db) return [];
    const stmt = this.db.prepare(
      'SELECT id, name, url, duration, sort_order, is_active, keep_alive, session_profile, created_at, updated_at FROM websites ORDER BY sort_order ASC'
    );
    const results: WebsiteSlide[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        id: String(row.id),
        name: String(row.name),
        url: String(row.url),
        duration: Number(row.duration) || 15,
        sort_order: Number(row.sort_order) || 0,
        is_active: Boolean(row.is_active),
        keep_alive: true,
        session_profile: String(row.session_profile || 'default'),
        created_at: String(row.created_at || ''),
        updated_at: String(row.updated_at || '')
      });
    }
    stmt.free();
    return results;
  }

  saveWebsite(slide: Omit<WebsiteSlide, 'created_at' | 'updated_at'>): WebsiteSlide {
    if (!this.db) throw new Error('Database not initialized');
    const now = new Date().toISOString();

    const cleanUrl = slide.url.trim();
    if (slide.id !== 'system-standby' && !cleanUrl.startsWith('local://standby')) {
      try {
        const parsed = new URL(cleanUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          throw new Error('Hanya protokol http:// dan https:// yang diizinkan');
        }
        if (!parsed.hostname) {
          throw new Error('Alamat hostname/IP tidak valid');
        }
      } catch (err) {
        throw new Error('Format URL tidak valid: ' + (err instanceof Error ? err.message : String(err)));
      }
    }

    const existingStmt = this.db.prepare('SELECT id, created_at FROM websites WHERE id = ?');
    existingStmt.bind([slide.id]);
    const exists = existingStmt.step();
    const createdAt = exists ? String(existingStmt.getAsObject().created_at) : now;
    existingStmt.free();

    this.db.run(
      `INSERT OR REPLACE INTO websites 
       (id, name, url, duration, sort_order, is_active, keep_alive, session_profile, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        slide.id,
        slide.name.trim() || 'Untitled Slide',
        cleanUrl,
        Math.max(3, slide.duration || 15),
        slide.sort_order || 0,
        slide.is_active ? 1 : 0,
        1,
        (slide.session_profile || 'default').trim() || 'default',
        createdAt,
        now
      ]
    );

    this.persist();

    return {
      ...slide,
      url: cleanUrl,
      created_at: createdAt,
      updated_at: now
    };
  }

  deleteWebsite(id: string): boolean {
    if (!this.db || id === 'system-standby') return false;
    this.db.run('DELETE FROM websites WHERE id = ?', [id]);
    this.persist();
    return true;
  }

  reorderWebsites(orderedIds: string[]): boolean {
    if (!this.db || !Array.isArray(orderedIds)) return false;
    const safeIds = orderedIds.slice(0, 500);
    this.db.run('BEGIN TRANSACTION;');
    try {
      for (let index = 0; index < safeIds.length; index++) {
        this.db.run('UPDATE websites SET sort_order = ? WHERE id = ?', [index, safeIds[index]]);
      }
      this.db.run('COMMIT;');
    } catch (err) {
      console.error('Failed to reorder websites:', err);
      this.db.run('ROLLBACK;');
      return false;
    }
    this.persist();
    return true;
  }

  getSettings(): AppSettings {
    const detectedLanguage = detectSystemLanguage();
    const defaultSettings: AppSettings = {
      auto_start_monitoring: true,
      idle_timeout_seconds: 30,
      default_duration: 15,
      start_fullscreen: false,
      theme: 'system',
      slide_animation: true,
      launch_on_startup: false,
      ignore_certificate_errors: true,
      language: detectedLanguage
    };

    if (!this.db) return defaultSettings;

    const stmt = this.db.prepare('SELECT key, value FROM settings');
    const loaded: Record<string, string> = {};
    while (stmt.step()) {
      const row = stmt.getAsObject();
      loaded[String(row.key)] = String(row.value);
    }
    stmt.free();

    return {
      auto_start_monitoring: loaded.auto_start_monitoring !== undefined 
        ? loaded.auto_start_monitoring === 'true' 
        : defaultSettings.auto_start_monitoring,
      idle_timeout_seconds: loaded.idle_timeout_seconds 
        ? parseInt(loaded.idle_timeout_seconds, 10) 
        : defaultSettings.idle_timeout_seconds,
      default_duration: loaded.default_duration 
        ? parseInt(loaded.default_duration, 10) 
        : defaultSettings.default_duration,
      start_fullscreen: loaded.start_fullscreen !== undefined 
        ? loaded.start_fullscreen === 'true' 
        : defaultSettings.start_fullscreen,
      theme: (loaded.theme === 'light' || loaded.theme === 'dark' || loaded.theme === 'system')
        ? loaded.theme
        : defaultSettings.theme,
      slide_animation: loaded.slide_animation !== undefined
        ? loaded.slide_animation === 'true'
        : defaultSettings.slide_animation,
      launch_on_startup: loaded.launch_on_startup !== undefined
        ? loaded.launch_on_startup === 'true'
        : false,
      ignore_certificate_errors: loaded.ignore_certificate_errors !== undefined
        ? loaded.ignore_certificate_errors === 'true'
        : true,
      language: (loaded.language === 'en' || loaded.language === 'id')
        ? loaded.language
        : detectedLanguage
    };
  }

  saveSettings(settings: AppSettings): boolean {
    if (!this.db) return false;
    const entries = [
      ['auto_start_monitoring', String(settings.auto_start_monitoring)],
      ['idle_timeout_seconds', String(settings.idle_timeout_seconds)],
      ['default_duration', String(settings.default_duration)],
      ['start_fullscreen', String(settings.start_fullscreen)],
      ['theme', settings.theme || 'system'],
      ['slide_animation', String(settings.slide_animation !== false)],
      ['launch_on_startup', String(settings.launch_on_startup === true)],
      ['ignore_certificate_errors', String(settings.ignore_certificate_errors !== false)],
      ['language', settings.language === 'en' ? 'en' : 'id']
    ];

    for (const [key, value] of entries) {
      this.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
    }

    if (settings.language === 'en') {
      this.db.run(`UPDATE websites SET name = 'Standby Screen' WHERE id = 'system-standby' AND name = 'Layar Standby'`);
    } else {
      this.db.run(`UPDATE websites SET name = 'Layar Standby' WHERE id = 'system-standby' AND name = 'Standby Screen'`);
    }

    if (settings.default_duration && settings.default_duration >= 3) {
      this.db.run('UPDATE websites SET duration = ?', [settings.default_duration]);
    }

    this.persist();
    return true;
  }
}
