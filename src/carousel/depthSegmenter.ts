import fs from 'fs';
import path from 'path';
import { PhotoStudioEnhancer } from './photoStudioEnhancer.js';

export interface DepthLayers {
  originalDataUri: string;
  cutoutDataUri: string;
  hasCutout: boolean;
}

export class DepthSegmenter {
  private static userAssetsDir = path.resolve(process.cwd(), 'assets', 'user');

  /**
   * Processa o retrato de estúdio do usuário para gerar as camadas de profundidade 3D
   * (Camada 1: Cenário Bokeh + Sujeito | Camada 3: Recorte 1:1 Transparente)
   */
  static async getDepthLayers(_inputPhotoPath?: string): Promise<DepthLayers> {
    try {
      const studioCutoutPath = path.join(this.userAssetsDir, 'avatar_studio_cutout.png');
      const needsRebuild = !fs.existsSync(studioCutoutPath);

      const assets = await PhotoStudioEnhancer.ensureEditorialStudioAssets(needsRebuild);

      return {
        originalDataUri: assets.studioBgDataUri,
        cutoutDataUri: assets.studioCutoutDataUri,
        hasCutout: true
      };
    } catch (err: any) {
      console.warn('⚠️ [DepthSegmenter] Erro ao preparar camadas 3D de estúdio:', err?.message || err);
      return {
        originalDataUri: '',
        cutoutDataUri: '',
        hasCutout: false
      };
    }
  }
}
