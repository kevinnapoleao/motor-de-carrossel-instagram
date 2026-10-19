# O que é um Git Worktree?

Um **Git Worktree** (árvore de trabalho) é um recurso do Git que permite ter múltiplos diretórios de trabalho vinculados ao mesmo repositório local.

### Principais Vantagens:
- **Trabalho Paralelo:** Você pode trabalhar em diferentes branches simultaneamente em pastas separadas, sem precisar alternar (`git checkout` / `git switch`) ou fazer `stash`/commit do trabalho em andamento.
- **Economia de Espaço:** Compartilha o mesmo diretório `.git` (histórico, commits, referências) do repositório principal, evitando clonar o repositório novamente.
- **Isolamento:** Ideal para rodar testes demorados, builds em segundo plano ou revisar pull requests sem interromper a branch atual.

### Comandos Comuns:
```bash
# Adicionar um novo worktree apontando para uma branch
git worktree add ../novo-diretorio branch-desejada

# Listar todos os worktrees ativos
git worktree list

# Remover um worktree que não é mais necessário
git worktree remove ../novo-diretorio
```
