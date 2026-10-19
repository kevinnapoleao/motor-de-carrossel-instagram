# Postiz API — notas para a integração do Ateliê Studio

Fontes oficiais consultadas em 2026-10-13:

- Visão geral/autenticação: https://docs.postiz.com/public-api/introduction
  - A API aceita API Key no header `Authorization`.
  - Postiz UI chama canais conectados de “channels”; API chama de “integrations”.
  - URL Cloud: `https://api.postiz.com/public/v1`.
  - Self-hosted documentado como `https://<domínio>/api/public/v1`.
  - Criar posts aceita `now`, `schedule` ou `draft`; usar `schedule` requer data ISO.
  - Exemplos usam ID real da integração, não o nome `instagram`.
  - Cada plataforma requer settings `__type` e algumas têm campos próprios.
  - Para Instagram, mídia é primeiro enviada; o `image` recebe objetos `{id,path}`.
- Lista de contas conectadas: https://docs.postiz.com/public-api/integrations/list
  - `GET /integrations` retorna canais com id, name, identifier, picture, profile e disabled.
- Criação/agendamento: https://docs.postiz.com/public-api/posts/create
  - `POST /posts` inclui `integration.id`, `value[].content`, `value[].image` e `settings.__type`.
  - A imagem exige upload prévio pelo endpoint público de mídia, não um caminho local.

Não foram usados tokens/chaves nem feitas chamadas autenticadas. A documentação confirma que o adapter atual (ID da plataforma como integration ID e caminho local como imagem) não está pronto para publicar.


## Adapter Postiz implementado (2026-10-13)

- Upload multipart: https://docs.postiz.com/public-api/uploads/upload-file — `POST /upload`, campo `file`, devolve `{id,path}`; aceitos PNG/JPEG/MP4 entre outros formatos documentados.
- Instagram: https://docs.postiz.com/public-api/providers/instagram — `__type` correto e múltiplos objetos em `image` formam carrossel.
- LinkedIn: https://docs.postiz.com/public-api/providers/linkedin — `linkedin`/`linkedin-page` e `post_as_images_carousel`.
- Threads: https://docs.postiz.com/public-api/providers/threads — `__type: threads`; o adapter limita o envio a uma lâmina.
- TikTok: https://docs.postiz.com/public-api/providers/tiktok — `DIRECT_POST` e privacidade, declarações de marca e IA explicitadas no modal.
- YouTube: https://docs.postiz.com/public-api/providers/youtube — título, visibilidade e declaração “feito para crianças” explícitos no modal.

O Cockpit valida a chave por `GET /integrations`, grava credenciais no `.env` local apenas após sucesso e nunca as devolve à interface. A aprovação mostra contas, textos, mídia e horários e o envio só começa após clique final. Testes locais validam formato de payload, sem rede; não há chave de usuário para validação autenticada nesta sessão.
