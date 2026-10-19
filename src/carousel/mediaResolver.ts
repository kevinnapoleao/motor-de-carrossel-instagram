import fs from 'fs';
import path from 'path';

export class MediaResolver {
  private static userAssetsDir = path.resolve(process.cwd(), 'assets', 'user');
  private static rawPhotosDir = path.resolve(process.cwd(), 'inputs', 'raw_photos');
  private static inputsDir = path.resolve(process.cwd(), 'inputs');

  /**
   * Retorna o retrato de estúdio 1080x1350 gerado por IA (com cenário bokeh de luxo)
   * ou faz fallback para a foto original do usuário em Data URI
   */
  static getUserAvatarDataUri(fallbackUrl?: string): string {
    // Prioridade 1: Retrato de Estúdio IA calibrado em 1080x1350
    const studio1080Path = path.join(this.userAssetsDir, 'avatar_studio_1080x1350.png');
    if (fs.existsSync(studio1080Path)) {
      const base64 = fs.readFileSync(studio1080Path).toString('base64');
      return `data:image/png;base64,${base64}`;
    }

    // Prioridade 2: Retrato de Estúdio IA bruto
    const studioRawPath = path.join(this.userAssetsDir, 'avatar_studio_raw.jpg');
    if (fs.existsSync(studioRawPath)) {
      const base64 = fs.readFileSync(studioRawPath).toString('base64');
      return `data:image/jpeg;base64,${base64}`;
    }

    const supportedExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];
    const searchDirs = [this.rawPhotosDir, this.inputsDir, this.userAssetsDir];

    for (const dir of searchDirs) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        const preferred = files.find((f) => {
          const lower = f.toLowerCase();
          if (lower.includes('cutout')) return false;
          return (
            (lower.includes('studio') ||
              lower.includes('avatar') ||
              lower.includes('profile') ||
              lower.includes('whatsapp') ||
              lower.includes('kevin') ||
              lower.includes('foto') ||
              lower.includes('photo')) &&
            supportedExtensions.some((ext) => lower.endsWith(ext))
          );
        });

        const targetFile =
          preferred ||
          files.find(
            (f) =>
              !f.toLowerCase().includes('cutout') &&
              supportedExtensions.some((ext) => f.toLowerCase().endsWith(ext))
          );

        if (targetFile) {
          const fullPath = path.join(dir, targetFile);
          if (fs.statSync(fullPath).isFile()) {
            const ext = path.extname(targetFile).toLowerCase().replace('.', '');
            const mimeType = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
            const base64 = fs.readFileSync(fullPath).toString('base64');
            return `data:${mimeType};base64,${base64}`;
          }
        }
      }
    }

    return fallbackUrl || 'https://api.dicebear.com/7.x/bottts/svg?seed=KevinTech';
  }

  /**
   * Retorna o recorte de primeiro plano 1080x1350 (com fundo transparente)
   * alinhado em 1:1 com a foto de estúdio para o efeito 3D (texto atrás da cabeça)
   */
  static getUserCutoutDataUri(): string | null {
    const cutoutPath = path.join(this.userAssetsDir, 'avatar_cutout.png');
    if (fs.existsSync(cutoutPath)) {
      const buffer = fs.readFileSync(cutoutPath);
      return `data:image/png;base64,${buffer.toString('base64')}`;
    }
    return null;
  }
}
