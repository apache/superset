# `test-ldap-user.sh`

Script utilitário para **testar busca de usuários no LDAP/Active Directory** a partir de configurações definidas em `loonar/.env`.

> Este documento usa **exemplos fictícios** (não são os valores reais do seu `.env`).

## O que o script faz

O script:

1. Valida pré-requisitos:
   - existência do arquivo `loonar/.env`;
   - comando `ldapsearch` instalado no sistema.
2. Permite escolher o ambiente de autenticação LDAP:
   - `1) Mock`
   - `2) Real`
3. Lê credenciais e conexão LDAP do `.env` de acordo com a opção escolhida.
4. Lê e interpreta as OUs de busca a partir da variável de base de usuários.
5. Solicita um valor de pesquisa (usuário simples ou filtro LDAP).
6. Executa buscas em cada OU configurada.
7. Se não encontrar, faz fallback para busca no diretório inteiro (base raiz derivada do DN).
8. Exibe resultado detalhado do(s) usuário(s) encontrado(s), incluindo atributos principais.

## Como executar

No diretório `loonar/`:

- execução padrão (modo interativo):
  - `./test-ldap-user.sh`
- execução com logs detalhados:
  - `./test-ldap-user.sh --verbose`
  - ou `./test-ldap-user.sh -v`
- ajuda:
  - `./test-ldap-user.sh --help`
  - ou `./test-ldap-user.sh -h`

## Fluxo interativo esperado

Durante a execução, o script pede:

1. **Ambiente LDAP** (`1` para Mock ou `2` para Real)
2. **Termo/filtro de busca**, por exemplo:
   - `j.silva`
   - `sAMAccountName=j.silva`
   - `(mail=j.silva@empresa.local)`

### Como o filtro é montado

- Se você já informar algo entre parênteses, o script usa diretamente.
- Se informar no formato `campo=valor`, ele transforma em `(campo=valor)`.
- Se informar apenas texto (`j.silva`), ele cria um filtro amplo:
  - `(|(sAMAccountName=j.silva)(userPrincipalName=j.silva)(mail=j.silva)(cn=*j.silva*))`

## O que ele retorna

O script imprime mensagens de status e termina com código de saída (`exit code`) apropriado.

### Retorno de sucesso (`exit 0`)

Quando encontra usuário em alguma OU mapeada **ou** no fallback da base raiz.

Exemplo fictício:

```text
==============================================
🔎 Teste de busca de usuário no Active Directory
==============================================

Escolha a base para autenticar no LDAP:
  1) Mock
  2) Real
Opção [1/2]: 2
Informe o usuário/filtro para pesquisa LDAP (ex: afarias ou sAMAccountName=afarias): j.silva

📌 Filtro utilizado: (|(sAMAccountName=j.silva)(userPrincipalName=j.silva)(mail=j.silva)(cn=*j.silva*))
📌 Busca inicial nas OUs da variável LOONAR_LDAP_USER_BASE_MOCK

➡️  Pesquisando em: OU=People,DC=empresa,DC=local
✅ Usuário encontrado na OU/base: OU=People,DC=empresa,DC=local
----------------------------------------------
dn: CN=Joao Silva,OU=People,DC=empresa,DC=local
cn: Joao Silva
mail: j.silva@empresa.local
sAMAccountName: j.silva
userPrincipalName: j.silva@empresa.local
----------------------------------------------

🏁 Busca concluída com sucesso nas OUs mapeadas.
```

### Retorno de erro (`exit 1`)

Quando ocorre qualquer falha de validação ou nenhum usuário é encontrado.

Casos comuns:

- `.env` ausente
- `ldapsearch` não instalado
- parâmetros LDAP obrigatórios vazios para a base selecionada
- termo de busca vazio
- usuário não encontrado nas OUs e também não encontrado no fallback

Exemplo fictício (usuário não encontrado):

```text
⚠️  Usuário não encontrado nas OUs mapeadas.
🔄 Tentando busca no diretório inteiro...
❌ Usuário não encontrado nas OUs configuradas nem no diretório inteiro (DC=empresa,DC=local).
```

## Modo verbose (`-v`)

Com `--verbose`, o script também mostra:

- servidor LDAP selecionado;
- DN de bind;
- se SSL está habilitado;
- comando/filtro de busca em execução;
- stderr do `ldapsearch` (útil para troubleshooting).

Exemplo fictício:

```text
[DEBUG] Modo verbose ativado
[DEBUG] Servidor LDAP: ldaps://ldap.empresa.local:636
[DEBUG] Bind DN: CN=svc-ldap,OU=Service Accounts,DC=empresa,DC=local
[DEBUG] LDAP_USE_SSL: true
[DEBUG] ldapsearch -H ldaps://ldap.empresa.local:636 -D CN=svc-ldap,OU=Service Accounts,DC=empresa,DC=local -b OU=People,DC=empresa,DC=local '(|(sAMAccountName=j.silva)... )'
```

## Resumo rápido

- Objetivo: validar busca LDAP de usuários com credenciais configuradas no `.env`.
- Tipo de execução: interativa.
- Sucesso: `exit 0` quando encontra usuário.
- Falha: `exit 1` para erro de configuração/pré-requisito ou ausência de resultado.
