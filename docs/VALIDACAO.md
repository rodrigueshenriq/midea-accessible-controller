# Validação técnica da edição pública

Verificações executadas em 28 de outubro de 2026, para preparar a publicação. Todos os controles usam simuladores ou dados fictícios. Não foram executados comandos físicos na lavadora.

## Resultados

| Verificação | Resultado efetivamente observado |
| --- | --- |
| `npm ci --ignore-scripts --no-audit --no-fund` | Dependências do lockfile instaladas |
| `npm test` | 35 testes aprovados; zero falhas, cancelamentos ou testes ignorados |
| `npm run test:runtime` | Aprovado em workerd com D1 local, lease, estado cifrado, RSA e VAPID |
| `npm run check` | Bundle e configuração validados por Wrangler em dry-run; sem deploy |
| `npm audit --json` | Zero vulnerabilidades conhecidas informadas pelo npm no momento da consulta |
| `node --check` | Verificação de sintaxe dos módulos JavaScript, sem falhas |
| Scanner de arquivos públicos | Sem arquivos privados proibidos ou contatos pessoais detectados |
| Gitleaks 8.30.1 | Sem ocorrências pendentes após revisão de fixtures sintéticas |
| Busca dirigida | 12 valores privados/configurações da origem ausentes da cópia pública |
| Detector Impeccable no arquivo alterado de login | Nenhum achado mecânico |

As primeiras tentativas de npm audit e runtime foram bloqueadas pelo ambiente restrito. Foram refeitas com acesso autorizado e os resultados acima são das execuções concluídas. O primeiro dry-run gerou aviso de permissão de log; uma nova execução concluiu sem esse aviso.

## O que os testes cobrem

Os 33 testes existentes na versão Workers foram preservados e ajustados para exemplos fictícios. Cobrem regras dos 14 programas, limites de adiamento, revisão obsoleta, pausa antes de substituir programa, ausência de início implícito, autenticação/assinatura, origem de requisição, proteção de conteúdo anônimo, transporte sem reenvio automático, renovação limitada de sessão e recuperação de notificações.

Dois testes adicionais verificam os riscos da sanitização: sem configuração de identidade, o acesso é recusado; sem parâmetros privados do protocolo, a conexão falha antes de fazer uma requisição à fabricante.

Os vetores criptográficos publicados foram recalculados em Python com hashlib, hmac e cryptography, usando apenas chaves e senhas sintéticas. Eles não contêm parâmetros da fabricante e não comprovam conexão física com a nuvem.

O teste workerd verifica persistência cifrada, exclusão mútua, token RSA de identidade fictícia, chave P-256 e assinatura VAPID verificada independentemente. Ele consulta certificados públicos do Google; não autentica uma conta nem acessa a lavadora.

## Segurança e histórico

A publicação foi construída por lista explícita de arquivos da versão Workers, sem copiar o diretório inteiro. Foram excluídos arquivos DPAPI, sessões, credenciais, logs, estados capturados, respostas da conta, dependências, caches, configuração privada, scripts de operação pessoal, binários do plugin e código Lua da fabricante.

Não havia `.git` na raiz do projeto de origem. Nenhum histórico anterior foi importado: o repositório público começa com commits novos da edição sanitizada. Isso evita transportar dados antigos; não comprova que a instalação jamais tenha sido compartilhada por outros meios.

A revisão detectou identidade pessoal e configuração Firebase de produção fixas em código e fixtures da origem. Esses valores foram removidos da edição pública. Não foi encontrada evidência de publicação anterior de senha ou token de conta Midea nesta revisão. Se esses arquivos tiverem sido compartilhados anteriormente, é necessário investigar o destino e revogar senhas/tokens/sessões Midea e credenciais de infraestrutura eventualmente expostos. Nenhum valor real é reproduzido aqui e nenhuma credencial de produção foi alterada.

O Gitleaks inicialmente apontou quatro ocorrências: três usos da mesma chave AES didática e um hash de senha fictícia. As exceções em `.gitleaks.toml` combinam arquivo e valor exato. Não há exclusão global de testes nem liberação de credenciais reais.

## Acessibilidade: evidências e pendências

A inspeção de código confirmou idioma pt-BR, landmarks, link de salto, rótulos, mensagens de status/erro, foco visível e programático, controles nativos, responsividade, suporte a cores forçadas e preferência de movimento reduzido.

Foi tentada uma prévia em localhost com um servidor de dados fictícios separado da aplicação. O navegador e a checagem HTTP retornaram timeout; por isso, esta publicação **não declara validação visual renderizada, axe, contraste completo, navegação manual por teclado ou testes reais com leitores de tela como aprovados**. Não foi alterado o visual existente.

Matriz ainda necessária:

- NVDA/Windows: escolher programa, alterar opções, aplicar, iniciar/pausar e ouvir atualizações.
- VoiceOver/Safari/iPhone: as mesmas tarefas e navegação por rotor.
- Teclado: sequência de foco, diálogo de confirmação, retorno do foco e estados dinâmicos.
- Ampliação, largura estreita, contraste e modo de cores forçadas em todas as telas.
- Aviso Push manual e término de um ciclo físico acompanhado do início ao fim.
- Favorito e combinações de opções no equipamento real.

WCAG 2.2 AA é uma referência desejada, não uma certificação ou resultado demonstrado por esta publicação.

## Diferenças da edição pública

- Identidade Firebase e parâmetros de transporte passaram a ser configuração externa.
- Autenticação recusa configuração ausente; as chaves da fabricante não são distribuídas.
- Credenciais, IDs de infraestrutura e origem pessoal foram substituídos por exemplos.
- A ponte com o portal privado do autor foi removida; login direto foi preservado.
- Controles reais começam desabilitados e cron exige ativação explícita.
- O ambiente local Python, os deploys pessoais e o protótipo Sites não são publicados.
- Atribuição MIT de midea-lan foi preservada; sem licença geral automaticamente atribuída.

Essas mudanças existem apenas na cópia pública. O código, as credenciais e os dados necessários à instalação original foram preservados.
