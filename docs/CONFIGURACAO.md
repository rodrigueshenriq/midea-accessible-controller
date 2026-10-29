# Configuração segura

## Ambiente de desenvolvimento

1. Instale Node.js 22.13+ e execute `npm ci` na raiz.
2. Execute `npm test` para verificar os fluxos com dados fictícios. Não é necessária uma conta Midea.
3. Para rodar a aplicação, copie `.env.example` para `.dev.vars`, ignorado pelo Git. Wrangler carrega esse arquivo no desenvolvimento; não é necessário instalar dotenv.
4. Em `wrangler.jsonc`, mantenha `PUBLIC_ORIGIN` igual à origem real do servidor local. O padrão é `http://localhost:8787`.
5. Prepare o banco com `npx wrangler d1 execute DB --local --file schema.sql` e inicie `npm run dev`.

## Identidade própria

Crie um projeto Firebase Authentication separado, habilite e-mail/senha, configure os domínios autorizados e crie a conta de acesso. Informe seu próprio `FIREBASE_PROJECT_ID`, `FIREBASE_OWNER_UID`, `FIREBASE_OWNER_EMAIL` e `FIREBASE_WEB_API_KEY` em `.dev.vars`. A API key web do Firebase é configuração de cliente, mas nenhum valor da produção original foi mantido.

A identidade é restrita ao UID e e-mail configurados, com e-mail verificado e validação RS256 dos tokens. Não basta criar qualquer conta Firebase. Se a configuração estiver ausente, a autenticação falha fechada.

A ponte de login com o portal pessoal do autor não faz parte da edição pública. O formulário de login direto foi preservado.

## Integração SmartHome

`MIDEA_CREDENTIALS_JSON` tem o formato abaixo, com valores exclusivamente fictícios:

```json
{
  "account": "user@example.test",
  "password": "EXAMPLE_PASSWORD",
  "target": {
    "device_id": "EXAMPLE_DEVICE_ID",
    "sn": "EXAMPLE_SERIAL"
  }
}
```

Os parâmetros `MIDEA_APP_KEY`, `MIDEA_IOT_KEY`, `MIDEA_HMAC_KEY`, `MIDEA_FIXED_KEY` e `MIDEA_FIXED_IV` precisam ser obtidos legitimamente e configurados privadamente. O repositório não contém os valores do transporte da fabricante. Os dois últimos são sequências ASCII usadas diretamente como bytes, não strings hexadecimais: chave AES de 16/24/32 bytes e IV de 16 bytes. Os valores de exemplo não são operacionais.

Essa externalização é uma diferença deliberada da edição pública. Os vetores de teste foram recalculados com parâmetros sintéticos em uma implementação Python independente. Os testes verificam algoritmos e fluxos, sem demonstrar interoperabilidade física com esses exemplos.

## Chave de armazenamento

Gere uma chave exclusiva de 32 bytes:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Guarde o resultado em `STATE_KEY`, somente no ambiente privado. Ela cifra o estado persistido no D1 com AES-256-GCM. Não publique nem troque essa chave em um banco existente sem um procedimento de migração: os dados anteriores ficariam ilegíveis. Nunca copie chaves ou bancos do ambiente pessoal do autor.

## Publicação de uma instância própria

A publicação deste código no GitHub não publica uma nova aplicação nem modifica a produção do autor.

Para uma instância própria, autentique Wrangler em sua conta, crie um D1 separado e substitua apenas os identificadores fictícios de `wrangler.jsonc`. Aplique `schema.sql` ao banco novo; não execute migrations em um banco de produção que não pertence a esta instalação. Configure a origem HTTPS e os domínios Firebase correspondentes.

Cadastre cada valor privado com `npx wrangler secret put NOME_DA_VARIAVEL` e a entrada interativa. Não passe segredos como argumentos de shell nem use o repositório para armazená-los. Use o painel ou o mesmo mecanismo para a identidade e a configuração pública de Firebase. Só então execute `npm run check` e, quando quiser publicar sua própria instância, `npm run deploy`.

O acesso a `process.env` no runtime está documentado na [compatibilidade Node.js do Cloudflare Workers](https://developers.cloudflare.com/workers/runtime-apis/nodejs/process/). A data de compatibilidade fixada no projeto habilita o comportamento necessário.

## Ativação do controle e dos avisos

`CONTROL_ENABLED` começa em `false`. Habilite-o apenas em sua própria instalação após conferir as leituras e as condições do equipamento. O remoto deve estar habilitado fisicamente; a aplicação não elimina intertravamentos da máquina.

O cron não acompanha a configuração pública. Para acompanhamento periódico em uma instância configurada, adicione a `wrangler.jsonc`:

```json
"triggers": {"crons": ["* * * * *"]}
```

O agendador desperta a cada minuto, mas o plano de leitura normalmente consulta a nuvem a cada 5 minutos em ciclo ativo, a cada minuto nos dez minutos finais, a cada 30 minutos quando parada e após 5 minutos em falha. A página aberta também faz suas próprias consultas. Isso consome cotas de Workers/D1 e não garante operação gratuita ilimitada.

Teste primeiro uma notificação manual, depois um ciclo acompanhado do início ao término. No iPhone, instale pela Tela de Início no Safari e conceda permissão de notificações. A aceitação pelo provedor Push não comprova que o usuário recebeu ou ouviu o aviso.
