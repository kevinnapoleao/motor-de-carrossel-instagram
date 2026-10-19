import { DepthSegmenter } from './depthSegmenter.js';

async function testSegmentation() {
  console.log('🧪 Testando segmentação de primeiro plano e profundidade 3D...');
  const layers = await DepthSegmenter.getDepthLayers();
  console.log(`Tem recorte (hasCutout): ${layers.hasCutout}`);
  console.log(`Tamanho original DataUri: ${layers.originalDataUri.length}`);
  console.log(`Tamanho cutout DataUri: ${layers.cutoutDataUri.length}`);
}

testSegmentation().catch(console.error);
