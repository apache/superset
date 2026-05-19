# reset-ass-userdb.sh

Este documento descreve o script `reset-ass-userdb.sh`, usado para resetar a senha de um usuário existente no Superset.

## O que o script faz

O script:

- recebe um usuário via parâmetro `--user`
- localiza um container ativo do Superset (`superset_app` ou `superset-superset_app`)
- verifica se o usuário existe no Superset
- se existir, gera uma senha aleatória com `secrets.token_urlsafe(24)`
- aplica hash da senha usando a mesma configuração de hash do Superset/FAB
- salva no banco de usuários
- imprime a nova senha atribuída para quem executou o script

## Como o script faz

Internamente, ele executa um bloco Python dentro do container do Superset (`docker exec`) que:

1. cria o app com `create_app()`
2. busca o usuário com `security_manager.find_user(username=...)`
3. gera senha aleatória
4. atualiza `user.password` com `generate_password_hash(...)`
5. faz `db.session.commit()`
6. retorna uma linha de controle:
   - `PASSWORD_RESET_OK:<nova_senha>` em sucesso
   - `USER_NOT_FOUND:<username>` quando não encontra o usuário

No shell, o script extrai essa linha de controle e exibe mensagens coloridas com emojis.

## Como executar

No diretório raiz do repositório:

```bash
./loonar/reset-ass-userdb.sh --user <usuario>
```

Exemplo:

```bash
./loonar/reset-ass-userdb.sh --user cristiano.santiago
```

## Resultado esperado

### Quando o usuário existe

Saída esperada (resumo):

- identificação do container Superset
- confirmação de reset de senha
- exibição da nova senha gerada
- mensagem final de sucesso

Exemplo de linhas-chave:

```text
✅ Senha resetada com sucesso para o usuário 'sandro.cicero'. 🎉
🔐 Nova senha atribuída: <valor_aleatorio>
✅ Processo concluído. 🚀
```

### Quando o usuário não existe

Saída esperada:

```text
❌ Usuário '<usuario>' não encontrado no Superset.
```

### Quando não encontra container do Superset

Saída esperada:

```text
❌ Não foi possível localizar um container do Superset (...)
```

## Pré-requisitos

- `docker` instalado no host
- container do Superset em execução
- permissões para executar `docker exec`
- script com permissão de execução (`chmod +x loonar/reset-ass-userdb.sh`)
