# Política de segurança

Não abra uma issue pública contendo credenciais, sessões, números de série, IDs do aparelho, capturas da conta, logs integrais ou reproduções autenticadas.

Para relatar vulnerabilidades, utilize o mecanismo privado de reporte do GitHub, se disponível no repositório. Se ele não estiver habilitado, solicite ao mantenedor um canal privado antes de compartilhar detalhes sensíveis.

Se publicar um segredo por acidente, revogue ou substitua a credencial no serviço de origem imediatamente e investigue o histórico. Apenas apagar o arquivo não revoga o segredo e não o remove dos commits anteriores.

## Controles do projeto

- Lista explícita de arquivos públicos; sem dados reais ou histórico da instalação pessoal.
- `.gitignore` bloqueia ambientes, caches, sessões, logs e artefatos.
- Exemplos usam dados fictícios e o controle real começa desabilitado.
- Testes de autorização, assinatura de tokens, origem, comandos, lease e Web Push.
- Scanner de arquivos e Gitleaks na integração contínua.
- Dependabot para alertas e atualizações revisáveis de dependências.

As verificações automáticas reduzem risco e não garantem ausência absoluta de vulnerabilidades. Não use dados pessoais ou chaves reais em testes, issues ou pull requests.
