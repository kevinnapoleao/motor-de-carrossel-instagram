import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export type JobStatus = 
  | 'TOPIC_SUGGESTED'
  | 'TOPIC_SELECTED'
  | 'CONTENT_GENERATED'
  | 'AWAITING_APPROVAL'
  | 'APPROVING'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'PARTIALLY_SCHEDULED'
  | 'REJECTED'
  | 'PUBLISHED';

export interface ContentJob {
  id: string;
  topic: string;
  status: JobStatus;
  reelsScript?: string;
  carouselData?: string;
  linkedinPost?: string;
  blogPost?: string;
  newsletter?: string;
  outputDir?: string;
  feedback?: string;
  createdAt: string;
  updatedAt: string;
}

export class StateMachineService {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const finalPath = dbPath || path.resolve(process.cwd(), 'database.sqlite');
    this.db = new Database(finalPath);
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS content_jobs (
        id TEXT PRIMARY KEY,
        topic TEXT NOT NULL,
        status TEXT NOT NULL,
        reelsScript TEXT,
        carouselData TEXT,
        linkedinPost TEXT,
        blogPost TEXT,
        newsletter TEXT,
        outputDir TEXT,
        feedback TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
    `);
  }

  public createJob(id: string, topic: string): ContentJob {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO content_jobs (id, topic, status, createdAt, updatedAt)
      VALUES (?, ?, 'TOPIC_SELECTED', ?, ?)
    `);
    stmt.run(id, topic, now, now);
    return this.getJob(id)!;
  }

  public updateJobContent(
    id: string,
    data: {
      reelsScript: any;
      carouselData: any;
      linkedinPost: string;
      blogPost: any;
      newsletter: any;
      outputDir: string;
    }
  ) {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE content_jobs
      SET reelsScript = ?,
          carouselData = ?,
          linkedinPost = ?,
          blogPost = ?,
          newsletter = ?,
          outputDir = ?,
          status = 'AWAITING_APPROVAL',
          updatedAt = ?
      WHERE id = ?
    `);
    stmt.run(
      JSON.stringify(data.reelsScript),
      JSON.stringify(data.carouselData),
      data.linkedinPost,
      JSON.stringify(data.blogPost),
      JSON.stringify(data.newsletter),
      data.outputDir,
      now,
      id
    );
  }

  public setStatus(id: string, status: JobStatus, feedback?: string) {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE content_jobs
      SET status = ?, feedback = ?, updatedAt = ?
      WHERE id = ?
    `);
    stmt.run(status, feedback || null, now, id);
  }

  public getJob(id: string): ContentJob | null {
    const stmt = this.db.prepare('SELECT * FROM content_jobs WHERE id = ?');
    const row = stmt.get(id) as ContentJob | undefined;
    return row || null;
  }

  public getLatestJob(): ContentJob | null {
    const stmt = this.db.prepare('SELECT * FROM content_jobs ORDER BY createdAt DESC LIMIT 1');
    const row = stmt.get() as ContentJob | undefined;
    return row || null;
  }

  public listJobs(limit = 10): ContentJob[] {
    const stmt = this.db.prepare('SELECT * FROM content_jobs ORDER BY createdAt DESC LIMIT ?');
    return stmt.all(limit) as ContentJob[];
  }
}
