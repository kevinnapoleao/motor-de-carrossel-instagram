import { StateMachineService, JobStatus } from './core/stateMachine.js';

const stateMachine = new StateMachineService();
const args = process.argv.slice(2);
const action = args[0]; // 'approve' | 'reject' | 'status' | 'list'
const jobId = args[1]; // optional
const feedback = args.slice(2).join(' ');

if (!action || action === 'status') {
  const latest = jobId ? stateMachine.getJob(jobId) : stateMachine.getLatestJob();
  if (!latest) {
    console.log('Nenhum trabalho encontrado no banco de dados.');
  } else {
    console.log(`\n📋 Status do Trabalho [${latest.id}]:`);
    console.log(`• Tema: ${latest.topic}`);
    console.log(`• Status Atual: ${latest.status}`);
    console.log(`• Pasta de Saída: ${latest.outputDir || 'N/A'}`);
    if (latest.feedback) console.log(`• Feedback: ${latest.feedback}`);
    console.log(`• Criado em: ${latest.createdAt}`);
    console.log(`• Atualizado em: ${latest.updatedAt}\n`);
  }
} else if (action === 'approve') {
  const target = jobId ? stateMachine.getJob(jobId) : stateMachine.getLatestJob();
  if (!target) {
    console.log('Nenhum trabalho para aprovar.');
  } else {
    stateMachine.setStatus(target.id, 'APPROVED', feedback || 'Aprovado via Console Interativo');
    console.log(`✅ Trabalho [${target.id}] APROVADO com sucesso! Pronto para agendamento/publicação.`);
  }
} else if (action === 'reject') {
  const target = jobId ? stateMachine.getJob(jobId) : stateMachine.getLatestJob();
  if (!target) {
    console.log('Nenhum trabalho para reprovar.');
  } else {
    stateMachine.setStatus(target.id, 'REJECTED', feedback || 'Reprovado pelo usuário');
    console.log(`❌ Trabalho [${target.id}] marcado como REPROVADO.`);
  }
} else if (action === 'list') {
  const jobs = stateMachine.listJobs(5);
  console.log(`\n📚 Últimos ${jobs.length} trabalhos:`);
  jobs.forEach((j) => {
    console.log(`- [${j.status}] ID: ${j.id} | Tema: "${j.topic}"`);
  });
  console.log('');
}
