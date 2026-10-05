# CRM de Prospecção

HTML, Tailwind CSS e JavaScript, com login e banco de dados no Firebase (projeto `crm-prospeccao-d28ae`).
Todos os arquivos ficam na mesma pasta, sem subpastas, para subir direto pelo site do GitHub.

| Arquivo | Para que serve |
|---|---|
| `index.html` | Página, configuração do Tailwind e cores |
| `app.js` | Telas e regras do funil |
| `db.js` | Login e banco de dados |
| `firebase-config.js` | Configuração do seu projeto Firebase |
| `netlify.toml` | Diz ao Netlify para publicar esta pasta |
| `firestore.rules` | Regras de segurança (cole no Firebase > Firestore > Regras) |

Deploy: GitHub conectado ao Netlify. Todo commit no GitHub publica sozinho em cerca de 1 minuto.
Lembre de adicionar o endereço do Netlify em Firebase > Authentication > Configurações > Domínios autorizados.
