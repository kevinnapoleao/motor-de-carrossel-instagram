import fs from 'node:fs/promises';
import path from 'node:path';

export interface PexelsVideoFile {
  id: number;
  quality: string;
  file_type: string;
  width: number;
  height: number;
  link: string;
}

export interface PexelsVideoResult {
  id: number;
  width: number;
  height: number;
  duration: number;
  video_files: PexelsVideoFile[];
}

export class PexelsService {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.PEXELS_API_KEY || '';
  }

  hasApiKey(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async searchVideos(query: string, orientation: 'portrait' | 'landscape' = 'portrait', perPage = 5): Promise<string[]> {
    if (!this.hasApiKey()) {
      return [];
    }

    try {
      const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=${orientation}&per_page=${perPage}`;
      const res = await fetch(url, {
        headers: {
          Authorization: this.apiKey,
        },
      });

      if (!res.ok) {
        console.warn(`[Pexels] Falha na busca por '${query}': ${res.status} ${res.statusText}`);
        return [];
      }

      const data = await res.json() as { videos?: PexelsVideoResult[] };
      if (!data.videos || data.videos.length === 0) return [];

      const downloadLinks: string[] = [];
      for (const v of data.videos) {
        // Encontrar arquivo com resolução adequada (HD ou próximo de 1080p)
        const sortedFiles = v.video_files
          .filter(f => f.file_type === 'video/mp4')
          .sort((a, b) => (b.width * b.height) - (a.width * a.height));
        
        if (sortedFiles.length > 0) {
          downloadLinks.push(sortedFiles[0].link);
        }
      }

      return downloadLinks;
    } catch (err) {
      console.error('[Pexels] Erro ao buscar vídeos de stock:', err);
      return [];
    }
  }

  async downloadVideo(url: string, destPath: string): Promise<boolean> {
    try {
      const res = await fetch(url);
      if (!res.ok) return false;
      const arrayBuffer = await res.arrayBuffer();
      await fs.writeFile(destPath, Buffer.from(arrayBuffer));
      return true;
    } catch (err) {
      console.error('[Pexels] Erro ao baixar vídeo de stock:', err);
      return false;
    }
  }
}
