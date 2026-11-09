# CaisMed – Front-end

Sistema web para rede de clínicas, em HTML, CSS e JavaScript puros (sem build). Tem quatro portais: **Paciente**, **Atendente**, **Médico** e **Administrador**. Funciona em celular, tablet, notebook e PC, e instala como PWA.

## Como abrir

Abra a pasta num servidor local (o PWA e o service worker não rodam em `file://`):

```
python3 -m http.server 8000
```

Depois acesse `http://localhost:8000`. Também funciona abrindo o `index.html` direto, só sem o modo offline.

## Contas de demonstração

| Perfil | Login | Senha |
|---|---|---|
| Paciente | CPF 390.533.447-05 | 123456 |
| Atendente | matrícula 1001 | caismed123 |
| Médico | matrícula 2001 (outros: 2002 a 2007) | caismed123 |
| Administrador | matrícula 9001 | caismed123 |

Para voltar aos dados iniciais: Admin, Configurações, Restaurar Dados de Demonstração.

## Estrutura

```
index.html ........ landing informativa
login.html, primeiro-acesso.html, recuperar-senha.html, estado.html ... telas públicas
home.html, consultas.html, agendamento.html ... portal do paciente
atendente-painel.html, agenda.html, fila.html, caixa.html ... portal do atendente
medico-painel.html, atendimento.html, prontuario.html ... portal do médico
admin-*.html ...... portal do administrador
style.css ......... design system e layout responsivo (celular, tablet, desktop)
app.js ............ TODO o JavaScript em um arquivo só (dados, regras, telas dos 4 portais e gerador de QR Code)
manifest.webmanifest, sw.js, icons/ ... PWA
```

**Importante:** o `app.js` precisa ficar na mesma pasta dos `.html`. Ao atualizar o projeto, apague os arquivos antigos e copie todos de novo (o `app.js` antigo do projeto anterior precisa ser substituído). Se ele não carregar, a página mostra um aviso vermelho na tela.

## Responsivo

- Até 699 px: barra de navegação embaixo, uma coluna.
- 700 a 1023 px (tablet): menu lateral compacto e grades de 2 a 3 colunas.
- A partir de 1024 px (notebook e PC): menu lateral completo, duas colunas e tabelas largas.
- Alvos de toque de 44 px ou mais, texto base de 16 px, tema claro e escuro, três tamanhos de texto, foco visível e rótulos em todos os campos.

## O que ainda é simulado (para o back-end)

Todos os dados ficam no `localStorage`. Os pontos a trocar por API estão marcados com `TODO` no código. Rotas sugeridas:

- `POST /auth/login`, `POST /auth/primeiro-acesso`, `POST /auth/recuperar-senha`
- `GET/POST /clientes`, `PUT /clientes/:id`
- `GET /medicos`, `GET /medicos/:id/horarios?data=`, `PUT /medicos/:id/disponibilidade`
- `GET/POST /consultas`, `PATCH /consultas/:id` (remarcar, cancelar, check-in, status)
- `POST /atendimentos/:id/finalizar` (gera receita, pedidos e atestado)
- `GET /documentos`, `GET/POST /autorizacoes`, `POST /pagamentos`, `POST /caixa/fechamento`
- `GET /auditoria`, `POST /ouvidoria`

Também dependem do back-end: senhas com hash (hoje ficam em texto no navegador), assinatura digital da receita e regras do CFM e da LGPD, envio real de WhatsApp, SMS e e-mail, vídeo da teleconsulta, pagamento Pix e cartão de verdade, e a IA do chatbot de triagem.

## Fora desta versão (fase 2)

Reembolso (C13), mensagens por WhatsApp (A12), modelos e atalhos do médico (M12), relatórios do médico (M13), encaminhamentos (M08), mapa interativo na busca e leitura de QR Code pela câmera.
