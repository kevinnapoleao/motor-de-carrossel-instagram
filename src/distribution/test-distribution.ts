import { SocialDistributionEngine, SocialPlatform } from './socialEngine.js';

function previewDistribution() {
  console.log('Prévia local de janelas fixas de referência. Nenhum post é agendado ou publicado.');
  const platforms: SocialPlatform[] = ['instagram', 'tiktok', 'youtube', 'threads', 'linkedin'];
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  for (const platform of platforms) {
    const result = SocialDistributionEngine.getReferenceScheduleTime(platform);
    console.log(`• ${platform}: ${new Date(result.scheduledTime).toLocaleString('pt-BR')} (${timeZone}) — ${result.reason}`);
  }
  console.log('\nA distribuição real exige integração Postiz e confirmação explícita no Cockpit.');
}

previewDistribution();
