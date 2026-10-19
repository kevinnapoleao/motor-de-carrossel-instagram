import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { MultiFormatContent, MultiFormatContentSchema } from './types.js';

dotenv.config();

export interface GenerationOptions {
  topic: string;
  brandDna: any;
  examples: any[];
}

export class ContentLlmEngine {
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
  }

  private buildSystemPrompt(brandDna: any, examples: any[]): string {
    return `
Você é o Diretor Editorial e Copywriter de ${brandDna.creator.name} (${brandDna.creator.handle}).
Nicho: ${brandDna.niche}

TOM E RITMO:
- ${brandDna.style.tone}
- ${brandDna.style.pacing}

REGRAS OBRIGATÓRIAS:
${brandDna.style.rules.map((rule: string) => `• ${rule}`).join('\n')}

EXPRESSÕES PROIBIDAS:
${brandDna.style.forbiddenWords.map((word: string) => `• "${word}"`).join('\n')}

EXEMPLOS DE VOZ:
${JSON.stringify(examples, null, 2)}

Gere em português, sem inventar estatísticas, cases, resultados do criador ou citações. Diferencie hipótese de fato. Produza os campos topic, reels {hook, body, visualNotes, cta}, carousel {theme, topic, slides}, linkedin, blog {title, metaDescription, markdown} e newsletter {subject, previewText, bodyMarkdown}. O carrossel deve ter 5 slides: capa, 3 passos e CTA. Respeite rigorosamente os limites do schema. Retorne apenas JSON válido.
`;
  }

  async generateContent(options: GenerationOptions): Promise<MultiFormatContent> {
    const { topic, brandDna, examples } = options;
    if (!this.apiKey || this.apiKey === 'sua_chave_gemini_aqui') {
      console.log(`✍️ [ContentEngine] Usando fallback editorial local (GEMINI_API_KEY ausente): "${topic}"`);
      return this.generateContextualContent(topic);
    }

    const systemPrompt = this.buildSystemPrompt(brandDna, examples);
    const userPrompt = `Gere o pacote completo para a pauta: "${topic}". Responda apenas com um objeto JSON válido.`;
    try {
      const ai = new GoogleGenAI({ apiKey: this.apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `${systemPrompt}\n\n${userPrompt}`,
        config: { responseMimeType: 'application/json', temperature: 0.7 }
      });
      if (!response.text) throw new Error('Resposta vazia da API Gemini');
      const validatedContent = MultiFormatContentSchema.parse(JSON.parse(response.text));
      console.log('✅ [Gemini LLM] Conteúdo validado pelo Zod.');
      return validatedContent;
    } catch (error) {
      console.error('❌ Erro na geração com Gemini LLM:', error);
      console.warn('🔄 Gerando pacote editorial local, sem alegações numéricas.');
      return this.generateContextualContent(topic);
    }
  }

  private generateContextualContent(topic: string): MultiFormatContent {
    const shortTopic = topic.length > 52 ? `${topic.slice(0, 49)}...` : topic;
    const newsletterSubject = `Ideia da semana: ${shortTopic}`;
    return {
      topic,
      reels: {
        hook: `A pergunta sobre ${shortTopic} não é se está em alta. É o que muda na prática.`,
        body: `Antes de adotar uma novidade, separe três coisas: a tarefa repetitiva, o critério de qualidade e o ponto que ainda pede julgamento humano. [CORTE] Escolha um fluxo pequeno. Compare tempo, retrabalho e erros antes e depois. Só então decida se vale ampliar.`,
        visualNotes: 'Abra com o gancho em plano fechado. Mostre a etapa do processo e um checklist curto. Use cortes nos respiros naturais; não cubra informação importante com texto.',
        cta: 'Salve este roteiro e escolha um fluxo real para testar nesta semana.'
      },
      carousel: {
        theme: 'magazine',
        topic,
        slides: [
          {
            type: 'cover', tag: 'IDEIAS & SISTEMAS', headline: shortTopic,
            subtitle: 'Um método prático para analisar a ideia, testar em pequena escala e medir antes de ampliar.',
            swipeText: 'ARRASTE PARA VER O MÉTODO →'
          },
          {
            type: 'content', step: '01', headline: 'Comece pelo problema, não pela ferramenta',
            body: 'Escolha uma etapa repetitiva e descreva o resultado esperado. Sem um problema observável, fica difícil saber se a mudança melhorou o fluxo.',
            highlight: 'Automatize uma tarefa clara, não um slogan.'
          },
          {
            type: 'content', step: '02', headline: 'Defina o que será medido',
            body: 'Registre tempo, retrabalho, custo e erros no processo atual. Essa linha de base permite comparar qualquer experimento sem depender de impressão.',
            highlight: 'Sem uma linha de base, não existe ganho comprovado.'
          },
          {
            type: 'content', step: '03', headline: 'Mantenha revisão humana',
            body: 'Teste com escopo pequeno, defina limites e revise as saídas. Mantenha alguém responsável quando contexto, qualidade ou risco exigirem julgamento.',
            highlight: 'Automatizar etapas não transfere responsabilidade.'
          },
          {
            type: 'cta', headline: 'Qual fluxo você testaria primeiro?',
            body: 'Escolha uma tarefa, defina um indicador e compare o antes com o depois. Compartilhe seu contexto nos comentários.',
            action: 'Salve este checklist para o próximo teste'
          }
        ]
      },
      linkedin: `A conversa sobre ${topic} merece uma pergunta objetiva:\n\nQual etapa do trabalho pode melhorar — e como você vai medir essa mudança?\n\nUm teste simples começa assim:\n\n1. Descreva o processo atual.\n2. Registre tempo, retrabalho e erros.\n3. Faça um piloto pequeno com limites claros.\n4. Compare os resultados antes de ampliar.\n\nSem uma linha de base, “ficou melhor” ainda é só uma impressão. E quando a tarefa envolve contexto ou risco, a revisão humana continua fazendo parte do sistema.\n\nQue processo você gostaria de testar primeiro?`,
      blog: {
        title: `Como avaliar ${topic} sem cair no hype`,
        metaDescription: `Um roteiro prático para avaliar ${topic}, desenhar um teste pequeno e decidir com base em medidas observáveis.`,
        markdown: `# Como avaliar ${topic} sem cair no hype\n\nUma ideia pode parecer promissora e ainda não resolver um problema real. Antes de adotar uma ferramenta ou redesenhar um processo, transforme a discussão em um teste que você consiga observar.\n\n## 1. Delimite a tarefa\n\nDescreva qual etapa do trabalho será avaliada, quem depende dela e qual resultado deve mudar. Escopos pequenos são mais fáceis de revisar e corrigir.\n\n## 2. Registre uma linha de base\n\nAnote o tempo gasto, o retrabalho, os erros e os custos relevantes no fluxo atual. Não use um número genérico de mercado como substituto dos dados da sua operação.\n\n## 3. Faça um piloto com limites\n\nEscolha um cenário controlado, defina o que exige revisão humana e observe casos em que o processo novo falha. Registre exceções, não apenas o caminho ideal.\n\n## 4. Compare e decida\n\nCompare as medidas do piloto com a linha de base. Amplie somente se o ganho observado compensar os novos custos, riscos e necessidades de manutenção.\n\n## Conclusão\n\n${topic} pode ser um bom ponto de partida para uma investigação. O próximo passo não é presumir o resultado: é escolher uma tarefa concreta e medir o que acontece.`
      },
      newsletter: {
        subject: newsletterSubject,
        previewText: 'Um roteiro de teste e revisão humana — sem promessas sem dados.',
        bodyMarkdown: `Olá!\n\nEsta edição é um rascunho editorial sobre **${topic}**.\n\nA ideia central é simples: comece pela tarefa, registre uma linha de base, rode um piloto pequeno e revise o resultado antes de ampliar.\n\nNão incluímos métricas de desempenho das suas redes neste texto. Quando houver dados medidos, eles podem orientar uma edição semanal específica no painel de métricas.\n\nAté a próxima,\nKevin`
      }
    };
  }
}
