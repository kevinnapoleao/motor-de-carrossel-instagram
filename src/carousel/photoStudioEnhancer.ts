import fs from 'fs';
import path from 'path';
import { removeBackground } from '@imgly/background-removal-node';
import { GoogleGenAI } from '@google/genai';

export interface StudioPhotoAssets {
  studioBgDataUri: string;
  studioCutoutDataUri: string;
  studioBgPath: string;
  studioCutoutPath: string;
}

export class PhotoStudioEnhancer {
  private static userAssetsDir = path.resolve(process.cwd(), 'assets', 'user');

  /**
   * Prepara o retrato de estúdio editorial gerado por IA (Camada 1)
   * e extrai o recorte transparente 1:1 com mesmas dimensões (Camada 3)
   * sem conflito de DLL nativa libvips no Windows.
   */
  static async ensureEditorialStudioAssets(forceRebuild = false): Promise<StudioPhotoAssets> {
    await fs.promises.mkdir(this.userAssetsDir, { recursive: true });

    const studioRawPath = path.join(this.userAssetsDir, 'avatar_studio_raw.jpg');
    const cutoutPath = path.join(this.userAssetsDir, 'avatar_studio_cutout.png');
    const legacyCutoutPath = path.join(this.userAssetsDir, 'avatar_cutout.png');

    if (!fs.existsSync(studioRawPath)) {
      await this.tryGenerateAiStudioPortrait(studioRawPath);
    }

    const sourcePhoto = fs.existsSync(studioRawPath)
      ? studioRawPath
      : path.join(this.userAssetsDir, 'avatar.jpeg');

    if (!fs.existsSync(cutoutPath) || forceRebuild) {
      console.log('✂️ [PhotoStudioEnhancer] Extraindo máscara alfa 3D 1:1 do retrato de estúdio...');
      const rawBuffer = fs.readFileSync(sourcePhoto);
      const blobInput = new Blob([rawBuffer], { type: 'image/jpeg' });
      const cutoutBlob = await removeBackground(blobInput);
      const arrayBuffer = await cutoutBlob.arrayBuffer();
      const cutoutBuffer = Buffer.from(arrayBuffer);

      fs.writeFileSync(cutoutPath, cutoutBuffer);
      fs.writeFileSync(legacyCutoutPath, cutoutBuffer);
      console.log('✅ [PhotoStudioEnhancer] Recorte 3D de estúdio gerado e sincronizado em 1:1!');
    }

    const bgBuffer = fs.readFileSync(sourcePhoto);
    const cutoutBuffer = fs.readFileSync(cutoutPath);

    return {
      studioBgDataUri: `data:image/jpeg;base64,${bgBuffer.toString('base64')}`,
      studioCutoutDataUri: `data:image/png;base64,${cutoutBuffer.toString('base64')}`,
      studioBgPath: sourcePhoto,
      studioCutoutPath: cutoutPath
    };
  }

  /**
   * Transforma uma selfie crua em retrato editorial de estúdio via Gemini API caso necessário
   */
  private static async tryGenerateAiStudioPortrait(targetOutputPath: string): Promise<void> {
    const apiKey = process.env.GEMINI_API_KEY;
    const rawAvatarPath = path.join(this.userAssetsDir, 'avatar.jpeg');
    if (!apiKey || !fs.existsSync(rawAvatarPath)) return;

    try {
      console.log('🎨 [PhotoStudioEnhancer] Gerando ensaio de estúdio editorial via Gemini AI...');
      const ai = new GoogleGenAI({ apiKey });
      const rawBase64 = fs.readFileSync(rawAvatarPath).toString('base64');

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-exp-image-generation',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: rawBase64
                }
              },
              {
                text: 'Transform this casual selfie into a luxury men magazine cover portrait (GQ / Homem Moderno style), preserving 100% of his facial identity. Dress him in a tailored black blazer and black turtleneck, warm Rembrandt studio lighting, golden rim light, and dark luxury lounge bokeh background. No text.'
              }
            ]
          }
        ]
      });

      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          fs.writeFileSync(targetOutputPath, Buffer.from(part.inlineData.data, 'base64'));
          console.log('✅ [PhotoStudioEnhancer] Retrato editorial gerado via API!');
          return;
        }
      }
    } catch (err: any) {
      console.warn('⚠️ [PhotoStudioEnhancer] Fallback para retrato de estúdio local:', err?.message);
    }
  }
}
