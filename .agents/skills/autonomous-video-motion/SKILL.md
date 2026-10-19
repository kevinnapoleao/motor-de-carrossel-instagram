---
name: autonomous-video-motion
description: >
  Arquitetura de edição autônoma de vídeos curtos (Reels, TikTok, Shorts) inspirada em browser-use/video-use e remotion-dev/skills.
  Use esta skill sempre que precisar editar vídeos brutos com jump cuts, remover claquete/silêncios, gerar Hook Banners,
  balões flutuantes de texto (callout bubbles), lower-thirds do criador, barra de retenção e legendas cinéticas estilo Hormozi.
---

# Autonomous Video & Motion Graphics Skill (`video-use` + `remotion-skills` Architecture)

Esta skill equipa o agente com o fluxo de pós-produção autônoma em **3 Estágios** para transformar vídeos brutos de câmera/celular em Reels/TikToks/Shorts de alta retenção dignos de estúdio.

## Arquitetura em 3 Estágios

### Estágio 1: Limpeza Acústica, EDL & Jump Cuts com Punch-In (`src/video/autoEditor.ts`)
1. **Detecção de Silêncio Calibrada (`-35dB`, `d=0.35s`):**
   - Preserva finais de frase suaves adicionando `padding = 0.14s` antes e depois de cada corte.
2. **Corte Automático de Claquete Pré-Take:**
   - Se o primeiro segmento de voz terminar antes de `1.48s` seguido de pausa (ex.: alguém nos bastidores dizendo *"E... já!"*), ele é descartado automaticamente da EDL.
3. **Punch-In Zoom Alternado (8%):**
   - Nos segmentos pares (`idx % 2 === 1`), aplica `crop=iw*0.92:ih*0.92` seguido de `scale=1080:1920:flags=lanczos,setsar=1` para criar dinamismo visual de corte de câmera sem perder resolução Full HD.

### Estágio 2: Identificação de Tema e Objetivo do Vídeo (`identifyVideoThemeAndObjective`)
**REGRA OBRIGATÓRIA ANTES DE CRIAR OS BALÕES:**
- Nunca gere balões genéricos desconectados do vídeo.
- Antes de desenhar qualquer overlay, acione `VideoMotionOverlayEngine.identifyVideoThemeAndObjective(duration, words, topic)`:
  1. Analisa a transcrição sincronizada e o contexto visual do vídeo.
  2. Define o **Tema Central (`theme`)** (ex.: *Review Prático: Fone Bluetooth Over-Ear*) e o **Objetivo do Vídeo (`objective`)** (ex.: *Demonstração Prática + Conversão no Link da Descrição*).
  3. Constrói a lista de balões (`cards`) estritamente alinhada a cada frase falada e ação demonstrada em cena.

### Estágio 3: Motion Graphics Programáticos & Balões Criativos (`src/video/motionOverlays.ts`)
Inspirado em `remotion-dev/skills` e `browser-use/video-use`, todos os elementos gráficos são desenhados em HTML/CSS de alta precisão (1080x1920) a partir do Tema e Objetivo identificados e renderizados com canal Alpha transparente (`omitBackground: true`) via Playwright antes da composição final no FFmpeg:

1. **Hook Banner Superior (`0.0s – 4.2s`):**
   - Posicionado na zona segura superior (`top: 120px`).
   - Contém tag dourada de categoria (`⚡ GANCHO / HOOK`), manchete curta de alto impacto e indicador visual de áudio ativo.
2. **Balões de Texto / Callouts Contextuais (`Speech & Insight Bubbles`):**
   - Cards flutuantes estilo *iMessage / Luxury Editorial Glassmorphism* (`backdrop-filter`, fundo `rgba(12, 12, 16, 0.88)`, borda dourada `#D4AF37`, ícone de contexto e título/subtítulo).
   - Sincronizados com os momentos-chave da fala (ex.: mudança de argumento, demonstração prática, teste de microfone virando de costas, insight técnico).
3. **Creator Lower-Third & Veredito Final:**
   - Card com o retrato de estúdio do criador (`assets/user/avatar_studio_raw.jpg`), handle `@kevin.tech`, selo verificado e chamada para ação (CTA).

### Estágio 3: Composição Multi-Camada FFmpeg + Legendas Cinéticas (`subtitles_hormozi.ass`)
1. **Upscaling & Color Grading:**
   - `scale=1080:1920:flags=lanczos`, nitidez óptica `unsharp=5:5:0.85:3:3:0.4` e ajuste de contraste/saturação (`eq=contrast=1.06:brightness=0.01:saturation=1.08`).
2. **Composição de Overlays (`overlay` com `enable='between(t,start,end)'`):**
   - Empilha os cards transparentes nos intervalos exatos da timeline.
3. **Legendas Karaoke Dinâmicas (`.ass`):**
   - Agrupadas em blocos de 2 a 3 palavras na zona segura inferior (`MarginV: 420`), com a palavra ativa em destaque Dourado/Amarelo (`#FFD700`) e *pop-in* de escala (`\fscx110\fscy110`).
4. **Barra de Progresso Dourada & Masterização `-14 LUFS`:**
   - Barra de retenção no rodapé e normalização `loudnorm=I=-14:LRA=11:TP=-1.5`.
