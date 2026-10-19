import { AutonomousEngine } from './engine.js';

async function main() {
  await AutonomousEngine.runFullCycle();
}

main().catch((err) => {
  console.error('❌ Erro na execução do ciclo autônomo:', err);
  process.exit(1);
});
