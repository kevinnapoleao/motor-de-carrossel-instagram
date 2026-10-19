# Ateliê Studio — @kevin.tech

Cockpit desktop local para radar editorial, geração de pacotes de conteúdo, renderização de carrosséis, edição de vídeo e aprovação de distribuição. O projeto usa o Node.js/TypeScript que já estava instalado neste computador.

## Abrir

- Clique duas vezes em [`ABRIR ATELIE STUDIO.bat`](./ABRIR%20ATELIE%20STUDIO.bat); ou
- No terminal desta pasta, execute `npm run dev` e abra <http://127.0.0.1:3000>.

O servidor fica limitado ao próprio computador (`127.0.0.1`). Para encerrá-lo, feche a janela de terminal do servidor. `npm run build` verifica o TypeScript.

## Fluxo

1. **Radar:** atualiza sinais públicos do Hacker News ao abrir ou ao clicar em “Atualizar radar”. Se a internet/API não responder, mostra sugestões editoriais locais, identificadas como referências — não como tendências atuais.
2. **Produção:** escolha uma pauta ou digite a sua. O motor gera Reels, carrossel, LinkedIn, artigo e newsletter; renderiza as lâminas em PNG 2160 × 2700 e salva os textos/Markdown dentro de `output/`.
3. **Revisão:** altere a voz em “Voz da marca”; abra cada formato e confira as lâminas antes de tomar uma decisão.
4. **Vídeo:** envie uma gravação local para corte de pausas, enquadramento vertical, masterização e exportação de MP4. O sistema não cria transcrição fictícia.
5. **Conectar canais:** conecte os perfis no painel Postiz e, na seção **Canais Postiz** do cockpit, informe a URL base e a chave da API. A chave é testada com uma leitura da lista de contas e só então salva localmente em `.env`; nunca é mostrada de volta.
6. **Aprovação e distribuição:** o modal mostra as contas reais, mídia, texto exato e janelas fixas de referência no fuso do computador (não são calculadas com o histórico da conta). Selecione as contas e revise cada texto. TikTok começa em “Somente eu”; YouTube começa “Não listado” e exige confirmar “feito para crianças?”. Só o botão final envia mídia ao Postiz e cria os agendamentos. Sem conexão válida, nada é agendado.
7. **Requisitos de vídeo:** TikTok e YouTube ficam indisponíveis até haver MP4 editado no Estúdio; o upload por esta API tem limite seguro local de 49 MB. Instagram e LinkedIn recebem as lâminas do carrossel; Threads recebe a primeira lâmina.
8. **Métricas/newsletter:** nesta versão os números são inseridos manualmente. O resumo semanal usa registros verificados informados pelo usuário nos últimos sete dias.

## Conexões opcionais

O arquivo `.env` não estava configurado. As conexões são opcionais:

- `GEMINI_API_KEY`: geração com Gemini e transcrição real para legendas sincronizadas. Sem essa chave, a geração usa o fallback local existente; o app indica que a IA não está conectada. Sem Gemini, os cortes e a exportação de vídeo ainda funcionam, mas **legendas/transcrição sincronizadas ficam indisponíveis**.
- `POSTIZ_API_URL` e `POSTIZ_API_KEY`: podem ser preenchidos pela página **Canais Postiz** (após gerar a chave em Settings no Postiz) ou manualmente usando `.env.example`. Para Postiz Cloud use `https://api.postiz.com/public/v1`; self-hosted deve terminar em `/api/public/v1`. O painel Postiz é onde você autoriza cada perfil; o cockpit só lista e agenda os canais já conectados.

O teste local `npm run postiz-test` valida os payloads sem fazer chamadas de rede. Não havia chave nem perfis conectados nesta sessão, então a autenticação real e os agendamentos ainda precisam ser confirmados pelo usuário na tela **Canais Postiz**. Nunca compartilhe o `.env`; ele já consta no `.gitignore`. Não há conexão direta de analytics às contas sociais nesta versão e não há tarefa diária em segundo plano enquanto o app está fechado. O radar consulta sinais ao abrir ou por atualização manual.

## Dados preservados

Jobs, métricas novas e resultados são locais: `database.sqlite`, `config/brand_dna.json`, `inputs/` e `output/`. Os registros antigos de desempenho tinham origem não verificável; permanecem no banco, mas são excluídos de gráficos e newsletters. Não foram apagados. Para uma newsletter baseada em dados verificados, lance os resultados recentes na tela **Métricas**.
