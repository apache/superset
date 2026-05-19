sync-ass-ad# Script `sync-ass-ad.sh`

## Propósito

O script `sync-ass-ad.sh` sincroniza roles e usuários do Apache Superset com grupos e contas do Active Directory (ou servidor LDAP mock). Para cada grupo cujo `CN` contenha o termo de filtro configurado, uma role homônima é criada (ou mantida) no Superset copiando as permissões de uma role base já existente. Os usuários membros desses grupos são criados automaticamente no Superset com as roles correspondentes. Todo o processo ocorre via container `superset_app`.

## Pré-requisitos

- Container Docker `superset_app` (ou `superset-superset_app`) em execução e com acesso à instância Superset configurada.
- Ferramentas locais: `docker` e `ldapsearch` disponíveis no `PATH`.
- Credenciais de serviço do Active Directory/LDAP com permissão de leitura para os grupos e usuários alvo.
- Role base no Superset já criada, contendo as permissões que serão clonadas para as novas roles.
- Arquivo `.env` no mesmo diretório do script, com as variáveis LDAP configuradas.

## Configuração via `.env`

O script carrega automaticamente as variáveis do arquivo  `.env` localizado no mesmo diretório do script. **Não aceita parâmetros de linha de comando** — toda a configuração vem do arquivo de ambiente.

### Variável de controle

| Variável              | Descrição                                                                                 |
|-----------------------|-------------------------------------------------------------------------------------------|
| `LOONAR_LDAP_MODE`    | Define qual conjunto de variáveis LDAP usar: `mock` (desenvolvimento) ou `real` (produção). **Obrigatória.** |

### Variáveis LDAP por modo

As variáveis abaixo são selecionadas automaticamente conforme o valor de `LOONAR_LDAP_MODE`:

| Uso interno (script)  | Modo `real`                        | Modo `mock`                        | Descrição                                      |
|-----------------------|------------------------------------|------------------------------------|-------------------------------------------------|
| `AD_URI`              | `LOONAR_LDAP_SERVER_REAL`          | `LOONAR_LDAP_SERVER_MOCK`          | URI do servidor LDAP (ex.: `ldap://host:389`).  |
| `AD_DN_BASE`          | `LOONAR_LDAP_USER_BASE_REAL`       | `LOONAR_LDAP_USER_BASE_MOCK`       | JSON com múltiplas OUs para busca de grupos e usuários. |
| `AD_SVC_USER`         | `LOONAR_LDAP_BIND_DN_REAL`         | `LOONAR_LDAP_BIND_DN_MOCK`         | DN do usuário de serviço para bind LDAP.        |
| `AD_SVC_PASSWORD`     | `LOONAR_LDAP_BIND_PASSWORD_REAL`   | `LOONAR_LDAP_BIND_PASSWORD_MOCK`   | Senha do usuário de serviço.                    |

### Variáveis comuns (independem do modo)

| Variável do `.env`                | Uso interno (script)    | Descrição                                                              |
|-----------------------------------|-------------------------|------------------------------------------------------------------------|
| `LOONAR_LDAP_GROUP_FILTERTERM`    | `AD_GROUP_FILTERTERM`   | Termo que deve aparecer no `CN` dos grupos para serem sincronizados.   |
| `LOONAR_LDAP_BASE_ROLE`          | `ASF_ROLE_BASE`         | Nome da role do Superset cujas permissões serão clonadas.              |
| `LOONAR_LDAP_EMAIL_DOMAIN`       | `AD_EMAIL_INVALID`      | Template de e-mail de fallback (ex.: `<usuario>@loonardc.local`).       |

### Exemplo de `.env`

```bash
# Modo: mock (desenvolvimento) ou real (produção)
LOONAR_LDAP_MODE=mock

# Servidor real
LOONAR_LDAP_SERVER_REAL=ldap://127.0.0.1:389
LOONAR_LDAP_BIND_DN_REAL=CN=Morpheus Serviços,OU=BR-BH,OU=03-SERVICOS,DC=loonardc,DC=local
LOONAR_LDAP_BIND_PASSWORD_REAL=SenhaSegura123
LOONAR_LDAP_USER_BASE_REAL={"Cliente":"OU=04-CLIENTES,DC=loonardc,DC=local","Administrador":"OU=04-USUARIOS,DC=loonardc,DC=local"}
LOONAR_LDAP_GROUP_BASE_REAL=OU=04-CLIENTES,DC=loonardc,DC=local

# Servidor mock
LOONAR_LDAP_SERVER_MOCK=ldap://127.0.0.1:3389
LOONAR_LDAP_BIND_DN_MOCK=CN=Morpheus Serviços,OU=BR-BH,OU=03-SERVICOS,DC=loonardc,DC=local
LOONAR_LDAP_BIND_PASSWORD_MOCK=SenhaSegura123
LOONAR_LDAP_USER_BASE_MOCK={"Cliente":"OU=04-CLIENTES,DC=loonardc,DC=local","Administrador":"OU=04-USUARIOS,DC=loonardc,DC=local"}
LOONAR_LDAP_GROUP_BASE_MOCK=OU=04-CLIENTES,DC=loonardc,DC=local

# Variáveis comuns
LOONAR_LDAP_GROUP_FILTERTERM=CONTROLE
LOONAR_LDAP_BASE_ROLE=LOONAR_BASE
LOONAR_LDAP_EMAIL_DOMAIN=<usuario>@loonardc.local
```

## Execução

O script não requer argumentos. Basta executá-lo a partir de qualquer diretório:

```bash
./loonar/sync-ass-ad.sh
```

Ou diretamente no diretório `loonar/`:

```bash
cd loonar/
./sync-ass-ad.sh
```

## Fluxo de execução

1. **Carrega `.env`** — lê `.env` do diretório do script (`./loonar`).
2. **Valida variáveis** — verifica se `AD_URI`, `AD_DN_BASE`, `AD_SVC_USER`, `AD_SVC_PASSWORD`, `AD_GROUP_FILTERTERM` e `ASF_ROLE_BASE` estão definidas e se `AD_DN_BASE` é um JSON válido.
3. **Verifica dependências** — confirma que `ldapsearch` e `docker` estão disponíveis.
4. **Localiza container** — busca `superset_app` ou `superset-superset_app` em execução.
5. **Valida role base** — verifica que a role `ASF_ROLE_BASE` existe no Superset.
6. **Busca grupos no AD** — executa `ldapsearch` em cada OU do JSON, filtrando grupos cujo `CN` contenha `AD_GROUP_FILTERTERM`, com logs por OU.
7. **Sincroniza roles** — cria no Superset as roles correspondentes aos grupos encontrados, clonando permissões da role base. Roles existentes são mantidas inalteradas.
8. **Busca usuários no AD** — lista usuários em cada OU do JSON, filtra membros dos grupos, e exibe contagem por OU.
9. **Sincroniza usuários** — cria no Superset os usuários que ainda não existem, associando-os às roles dos seus grupos. Usuários com e-mail inválido recebem o e-mail gerado pelo template `AD_EMAIL_INVALID`. Usuários existentes são mantidos inalterados.

## Agendamento via cron

O script carrega o `.env` automaticamente, então basta apontar para o executável. Exemplo (execução diária às 02h00, sobrescrevendo o log do dia da semana):

```cron
# Min Hora Dia Mês DiaSemana Comando
0 2 * * * /root/superset/loonar/sync-ass-ad.sh > /var/log/sync-ass-ad-$(date +\%a).log 2>&1
```

- O `$(date +%a)` gera `Mon`, `Tue`, etc., formando o arquivo `sync-ass-ad-Mon.log`.
- O redirecionamento `>` substitui o arquivo se já existir.
- Certifique-se de que o arquivo `.env` exista no diretório `loonar/`.
- Após salvar o crontab, confirme com `crontab -l` e monitore os logs para garantir que o container `superset_app` esteja disponível no horário programado.

## Mensagens e retorno

- Mensagens de progresso e debug são enviadas para `stderr`, incluindo o que foi encontrado por OU.
- Qualquer falha crítica (ex.: container inexistente, role base não encontrada, variáveis ausentes) encerra o script imediatamente com código diferente de zero.
- Ao final, exibe `✓ Sincronização concluída com sucesso!` em caso de sucesso.

## Boas práticas

- Teste primeiro em modo `mock` (`LOONAR_LDAP_MODE=mock`) para validar o fluxo completo antes de apontar para o AD real.
- Garanta que a role base contenha apenas as permissões desejadas, já que serão clonadas integralmente.
- Utilize usuários de serviço dedicados, com senha armazenada de forma segura (ex.: `pass`, `vault`, variáveis de ambiente protegidas).
- O script é idempotente: roles e usuários já existentes são mantidos inalterados, permitindo re-execuções seguras.
