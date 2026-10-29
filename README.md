# Minha Lavadora — controle acessível para Midea

Interface web independente para preparar e acompanhar a lavagem com foco na autonomia de pessoas com deficiência visual. Projeto pessoal de integração de sistemas, desenvolvimento web e acessibilidade digital.

**Projeto não oficial, sem vínculo, patrocínio ou aprovação da Midea.** Midea e os nomes de seus produtos pertencem aos respectivos titulares. Este repositório publica uma edição sanitizada da implementação em Cloudflare Workers; não publica o ambiente pessoal em produção.

## O problema e a motivação

A solução nasceu da necessidade do autor de operar sua lavadora sem depender das barreiras de acessibilidade encontradas no aplicativo SmartHome. O objetivo é tornar a escolha de programas, os ajustes e a leitura do andamento mais compreensíveis e utilizáveis por teclado e tecnologias assistivas.

O problema é relatado no contexto de uso do autor. Este trabalho não constitui uma auditoria completa do aplicativo original nem afirma que todas as suas versões apresentam as mesmas barreiras.

## O que o projeto demonstra

- Tradução de um problema cotidiano em uma interface orientada à autonomia.
- Separação entre interface, regras de domínio, transporte, autenticação e persistência.
- Validação de opções específicas do equipamento e confirmação do estado após comandos.
- Proteção de credenciais no servidor e testes de controles de acesso e criptografia.
- Comunicação acessível de rascunhos, estados confirmados, erros e operações em andamento.

## Funcionalidades implementadas

- Catálogo de 14 programas para o modelo MF200W110WB/GK-01, subtipo 18485.
- Ajustes de temperatura, centrifugação e opções como pré-lavagem, vapor, tira-manchas, turbo e enxágue adicional, respeitando os limites de cada programa.
- Aplicação de configurações separada do início da lavagem.
- Início, pausa, solicitação para adicionar roupas, energia e trava do painel.
- Adiamento entre 1 e 24 horas, cancelamento e solicitação de gravação de favorito.
- Consulta de estado, revisão para bloquear alterações sobre leituras antigas e confirmação após operações.
- Autenticação Firebase limitada a um proprietário autorizado, com verificação de assinatura e validade do token.
- Web Push com VAPID, fila de saída persistida e acompanhamento de término observado.

A presença do código não comprova funcionamento físico de todas as opções. Os testes desta publicação usam simuladores; nenhum comando foi enviado à lavadora para preparar este repositório. A gravação de favorito e a entrega real de notificações continuam exigindo validação no aparelho.

## Tecnologias utilizadas

| Camada | Implementação |
| --- | --- |
| Interface | HTML semântico, CSS e JavaScript sem framework |
| Backend | JavaScript em módulos ES, Cloudflare Workers e compatibilidade Node.js |
| Persistência | Cloudflare D1 / SQLite, estado cifrado e exclusão mútua por lease |
| Identidade | Firebase Authentication, tokens RS256 e conta autorizada |
| Integração | HTTPS com a nuvem SmartHome; transporte adaptado de midea-lan |
| Avisos | Service Worker, Push API, VAPID e criptografia Web Push |
| Qualidade | node:test, assert, Miniflare/workerd, Wrangler e Gitleaks |

O projeto de origem também possui um servidor local Python com aiohttp e midea-lan, armazenamento Windows DPAPI e uma variante de nuvem com Firestore. Esses ambientes e o protótipo separado de site foram analisados, mas não são redistribuídos aqui: contêm integrações pessoais e materiais que não são necessários para compreender a implementação principal. Não há React ou TypeScript na aplicação publicada.

## Arquitetura e integração

```text
Navegador / PWA
    | HTTPS + cookie HttpOnly
Cloudflare Worker
    |-- Firebase: verifica identidade e restringe proprietário
    |-- Domínio: valida opções, revisão e segurança dos comandos
    |-- D1: estado cifrado, sessão, lease e fila de notificações
    |-- HTTPS: nuvem SmartHome -> lavadora cadastrada
    |-- Web Push: provedor do navegador
```

O navegador nunca recebe a senha Midea. O backend autentica a conta, confirma o identificador e o número de série do equipamento e consulta a nuvem. O controle verifica as condições de operação e lê o estado novamente. Uma resposta perdida de controle não provoca reenvio automático.

Não é uma integração LAN direta nem uma API oficial oferecida por este projeto. Depende de serviços de terceiros e de parâmetros de protocolo configurados privadamente. Mudanças nesses serviços podem interromper a integração.

O agendador pode acompanhar ciclos sem a página aberta. A configuração pública mantém controles reais desabilitados e não habilita o cron automaticamente. Consulte [instalação e configuração](docs/CONFIGURACAO.md).

## Acessibilidade

A interface preserva HTML nativo, idioma `pt-BR`, regiões semânticas, link para pular ao conteúdo, rótulos em formulários, foco visível, foco programático em mudanças de tela e mensagens com `role="status"` e `role="alert"`. O estado do equipamento é apresentado em texto, sem depender apenas de cor. Há adaptação para telas menores e tratamento de redução de movimento no CSS.

NVDA no Windows e VoiceOver no Safari/iPhone são tecnologias alvo do projeto. **Não há comprovação de compatibilidade integral nem certificação WCAG.** É necessário validar tarefas reais com esses leitores, navegação por teclado, ampliação e contraste em todos os estados. Consulte a [matriz de validação e limitações](docs/VALIDACAO.md).

## Instalação e execução

Requisitos: Node.js 22.13 ou superior e npm. Python 3 é usado somente pelo verificador adicional de arquivos públicos. Para usar a integração real, são necessários recursos próprios em Cloudflare/Firebase e uma conta autorizada da lavadora.

```sh
git clone https://github.com/rodrigueshenriq/midea-accessible-controller.git
cd midea-accessible-controller
npm ci
npm test
npm run check
```

Os testes unitários usam dados fictícios e não precisam de conta, lavadora ou serviços hospedados. `npm run check` gera um bundle de validação local, sem publicar a aplicação.

Para executar o Worker localmente, copie `.env.example` para `.dev.vars`, configure sua própria identidade, prepare o D1 local e execute:

```sh
npx wrangler d1 execute DB --local --file schema.sql
npm run dev
```

A configuração fictícia não permite login real nem conexão à Midea. Nenhuma credencial de exemplo funciona. Os parâmetros privados da fabricante não são fornecidos no repositório. Leia as [instruções completas de configuração](docs/CONFIGURACAO.md) antes de usar um aparelho real.

## Testes e segurança

```sh
npm test
npm run test:runtime
npm run check
npm audit
python scripts/scan-public.py
gitleaks dir . --redact --no-banner
gitleaks git . --redact --no-banner
```

O teste de runtime usa workerd e D1 locais com identidade fictícia; consulta apenas o endpoint público de certificados do Google, sem acessar a lavadora. Os resultados efetivamente executados estão em [Validação técnica](docs/VALIDACAO.md).

O repositório tem histórico novo. Credenciais, sessões, arquivos `.env` reais, identificadores do aparelho, logs, capturas de estado, binários do plugin, protocolo Lua, backups e configurações de produção não são publicados. O `.gitignore` e a automação de segurança reduzem riscos de inclusão acidental; nenhuma ferramenta garante ausência absoluta de segredos.

## Limitações e próximos passos

- Compatibilidade restrita ao modelo e catálogo estudados; não é um controlador universal.
- A integração depende da nuvem Midea, conectividade, permissão de controle remoto e estado físico seguro do aparelho.
- Notificações de término estão implementadas e têm testes simulados. A entrega real no iPhone e a confirmação ao final de um ciclo permanecem pendentes de validação.
- O acompanhamento precisa observar o início e o término do mesmo programa. Um ciclo inteiro ocorrido entre consultas pode não ser detectado.
- No iPhone, avisos dependem do suporte do Safari, instalação na Tela de Início e permissão do usuário.
- Tempos de lavagem são estimativas; a confirmação do equipamento tem prioridade.
- Favorito, todas as combinações de opções e acessibilidade com leitores reais ainda precisam de uma matriz de testes em hardware.
- A configuração de exemplo não reproduz a produção; exige recursos e parâmetros privados próprios.

Nunca force a abertura da porta. Respeite o manual, as travas e as condições físicas do equipamento.

## Direitos e independência

O transporte indica adaptação de midea-lan, cuja [licença MIT e atribuição foram preservadas](third_party/midea-lan.LICENSE). O catálogo publicado contém descrições da interface e parâmetros de interoperabilidade; não inclui o plugin ou o código Lua da fabricante.

Não foi adicionada uma licença geral automaticamente: os direitos sobre o conjunto completo ainda precisam de confirmação pelo autor. As licenças de terceiros continuam válidas para seus respectivos componentes. A disponibilidade pública não equivale a uma autorização geral de redistribuição.
