# CHANGELOG.md - Histórico de Mudanças

Este arquivo documenta as alterações significativas realizadas no projeto Loonar.

## [v1.1.1] - 2026-04-07

### Segurança
- **Correção CVE-2026-1642**: Atualização da imagem base do Nginx de `1.25-alpine` para `1.28.2-alpine`. Esta mudança mitiga o risco de injeção de dados em texto simples em respostas de servidores fixados em upstream (MITM).

### Documentação
- Inclusão do arquivo `THIRDPARTY.md` na raiz para inventário de soluções.
- Criação deste `docs/CHANGELOG.md` para melhor rastreabilidade.
- Atualização do `README.md` da raiz para conformidade com padrões DevOps/SRE.

---
*Referência do Padrão:* [Conventional Commits](https://www.conventionalcommits.org/pt-br/)
