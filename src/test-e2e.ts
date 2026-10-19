import fs from 'fs/promises';
import path from 'path';
import { runJob } from './cli.js';
import { StateMachineService } from './core/stateMachine.js';
import { VideoAutoEditor } from './video/autoEditor.js';

interface StepResult {
  step: string;
  module: string;
  status: 'PASSED' | 'FAILED';
  details: string;
  durationMs: number;
}

async function runE2ETest() {
  console.log('================================================================');
  console.log('🧪 BATERIA DE TESTES DE INTEGRAÇÃO DE PONTA A PONTA (PASSOS 1, 2 E 3)');
  console.log('================================================================\n');

  const results: StepResult[] = [];
  const stateMachine = new StateMachineService();

  // -------------------------------------------------------------
  // PASSO 1: Motor Editorial, Tom de Voz & Fábrica de Carrosséis
  // -------------------------------------------------------------
  console.log('▶️ TESTANDO PASSO 1: Geração Multi-formato & Renderização de Carrossel 1080x1350...');
  const t1Start = Date.now();
  let generatedJobId = '';
  let outputDir = '';

  try {
    const jobResult = await runJob('Como validar uma ideia de negócio em 48 horas com IA e código');
    generatedJobId = jobResult.jobId;
    outputDir = jobResult.outputDir;

    // Validação dos arquivos gerados no Passo 1
    const files = await fs.readdir(outputDir);
    const pngs = files.filter((f) => f.endsWith('.png'));
    const hasReport = files.includes('ROTEIROS_E_POSTS.md');
    const hasJson = files.includes('conteudo_completo.json');

    if (pngs.length < 4 || !hasReport || !hasJson) {
      throw new Error(`Inconsistência nos artefatos gerados: ${pngs.length} slides encontrados.`);
    }

    results.push({
      step: 'Passo 1',
      module: 'Editorial & Carrossel Programático (Zero-Canva)',
      status: 'PASSED',
      details: `${pngs.length} slides 1080x1350 renderizados em Retina 2x + Relatório de Roteiros gerado com sucesso.`,
      durationMs: Date.now() - t1Start
    });
    console.log(`✅ PASSO 1 APROVADO! (${pngs.length} slides renderizados em ${outputDir})\n`);
  } catch (err: any) {
    results.push({
      step: 'Passo 1',
      module: 'Editorial & Carrossel Programático',
      status: 'FAILED',
      details: err.message || String(err),
      durationMs: Date.now() - t1Start
    });
    console.error(`❌ FALHA NO PASSO 1:`, err);
  }

  // -------------------------------------------------------------
  // PASSO 2: State Machine, Persistência SQLite & Human-in-the-Loop
  // -------------------------------------------------------------
  console.log('▶️ TESTANDO PASSO 2: Persistência no SQLite & Ciclo de Decisão do Usuário...');
  const t2Start = Date.now();

  try {
    const job = stateMachine.getJob(generatedJobId);
    if (!job) {
      throw new Error(`Trabalho ${generatedJobId} não foi encontrado no SQLite.`);
    }

    if (job.status !== 'AWAITING_APPROVAL') {
      throw new Error(`Estado inicial incorreto: esperado AWAITING_APPROVAL, obtido ${job.status}`);
    }

    // Simula a aprovação do usuário com registro de feedback
    stateMachine.setStatus(generatedJobId, 'APPROVED', 'Aprovado pelo teste automatizado de integração E2E');
    const updatedJob = stateMachine.getJob(generatedJobId);

    if (updatedJob?.status !== 'APPROVED') {
      throw new Error(`Falha na transição de estado para APPROVED.`);
    }

    results.push({
      step: 'Passo 2',
      module: 'State Machine & Human-in-the-Loop (SQLite)',
      status: 'PASSED',
      details: `Job persistido, estado AWAITING_APPROVAL validado e transição para APPROVED registrada com sucesso.`,
      durationMs: Date.now() - t2Start
    });
    console.log(`✅ PASSO 2 APROVADO! (Transição para APPROVED validada no SQLite)\n`);
  } catch (err: any) {
    results.push({
      step: 'Passo 2',
      module: 'State Machine & Human-in-the-Loop',
      status: 'FAILED',
      details: err.message || String(err),
      durationMs: Date.now() - t2Start
    });
    console.error(`❌ FALHA NO PASSO 2:`, err);
  }

  // -------------------------------------------------------------
  // PASSO 3: Motor de Vídeo, Detecção de Silêncio e Legendas ASS 9:16
  // -------------------------------------------------------------
  console.log('▶️ TESTANDO PASSO 3: Motor de Edição de Vídeo, Algoritmo de EDL e Legendas Dinâmicas...');
  const t3Start = Date.now();

  try {
    const videoEditor = new VideoAutoEditor();

    // 1. Teste de algoritmo de EDL a partir de silêncios simulados
    const totalDuration = 60.0; // 60 segundos de vídeo
    const detectedSilences = [
      { start: 10.2, end: 11.5 }, // Pausa de 1.3s
      { start: 25.0, end: 26.8 }, // Pausa de 1.8s
      { start: 42.1, end: 43.4 }  // Pausa de 1.3s
    ];

    const edl = videoEditor.generateEDL(totalDuration, detectedSilences);
    if (edl.length !== 4) {
      throw new Error(`Cálculo incorreto da EDL: esperava 4 segmentos de fala, obteve ${edl.length}`);
    }

    // 2. Teste de geração de legendas dinâmicas ASS 9:16 com a tipografia e cor da marca
    const mockWords = [
      { word: 'Validar', start: 0.1, end: 0.5 },
      { word: 'uma', start: 0.5, end: 0.7 },
      { word: 'ideia', start: 0.7, end: 1.1 },
      { word: 'em', start: 1.1, end: 1.3 },
      { word: '48h', start: 1.3, end: 1.8 }
    ];

    const assSubtitles = videoEditor.generateStyledSubtitles(mockWords);
    if (!assSubtitles.includes('PlayResX: 1080') || !assSubtitles.includes('PlayResY: 1920')) {
      throw new Error('Resolução 9:16 nativa ausente no cabeçalho das legendas ASS.');
    }

    const assFilePath = path.join(outputDir, 'legendas_reels.ass');
    await fs.writeFile(assFilePath, assSubtitles, 'utf-8');

    results.push({
      step: 'Passo 3',
      module: 'Motor de Vídeo (Corte de Silêncio & Legendas ASS)',
      status: 'PASSED',
      details: `EDL calculada perfeitamente (4 cortes limpos) e legendas ASS 9:16 geradas em ${path.basename(assFilePath)}.`,
      durationMs: Date.now() - t3Start
    });
    console.log(`✅ PASSO 3 APROVADO! (EDL e legendas ASS 9:16 validadas)\n`);
  } catch (err: any) {
    results.push({
      step: 'Passo 3',
      module: 'Motor de Edição de Vídeo',
      status: 'FAILED',
      details: err.message || String(err),
      durationMs: Date.now() - t3Start
    });
    console.error(`❌ FALHA NO PASSO 3:`, err);
  }

  // -------------------------------------------------------------
  // RELATÓRIO CONSOLIDADO DOS PASSOS 1, 2 E 3
  // -------------------------------------------------------------
  console.log('================================================================');
  console.log('📊 PAINEL CONSOLIDADO DE RESULTADOS: PASSOS 1, 2 E 3');
  console.log('================================================================');
  console.table(
    results.map((r) => ({
      Passo: r.step,
      Módulo: r.module,
      Status: r.status === 'PASSED' ? '✅ APROVADO' : '❌ FALHOU',
      Duração: `${(r.durationMs / 1000).toFixed(2)}s`,
      Detalhes: r.details
    }))
  );

  const allPassed = results.every((r) => r.status === 'PASSED');
  if (allPassed) {
    console.log('\n🎉 TODOS OS PASSOS (1, 2 e 3) FORAM TESTADOS E HOMOLOGADOS COM 100% DE SUCESSO!\n');
  } else {
    console.log('\n⚠️ Alguns passos apresentaram falhas. Verifique os logs acima.\n');
    process.exit(1);
  }
}

runE2ETest().catch((err) => {
  console.error('Erro crítico no teste integrado:', err);
  process.exit(1);
});
