CONFERÊNCIA DE CARGAS | ATLAS v1
===================================

O que é
-------
Protótipo funcional de um aplicativo independente para conferência de cargas.
Esta versão roda em navegador e salva os dados localmente no próprio dispositivo.

Recursos incluídos
------------------
- Iniciar conferência
- Visualizar cargas em andamento
- Registrar desvios
- Registrar nova ação/tratativa
- Concluir tratativas
- Bloquear encerramento quando houver desvio pendente
- Validar "Carga Conforme"
- Histórico por carga
- Indicadores básicos
- Interface responsiva para celular
- Estrutura PWA (pode ser instalada como app quando hospedada em HTTPS)

Como executar
-------------
Opção 1 - teste simples em PC:
1. Extraia o arquivo ZIP.
2. Abra o arquivo index.html no Chrome ou Edge.
3. Navegue pelo aplicativo.

Opção 2 - funcionamento PWA/offline completo:
1. Na pasta do projeto, execute um servidor HTTP local.
   Exemplo com Python:
   python -m http.server 8080
2. Acesse:
   http://localhost:8080

Observação importante
---------------------
Os dados desta versão ficam em localStorage. Isso significa que:
- não há sincronização entre celulares;
- não há login corporativo;
- não há SharePoint/banco central;
- limpar os dados do navegador apaga os registros.

Arquitetura recomendada para a versão corporativa
--------------------------------------------------
Frontend: PWA responsiva
Backend/API: serviço autenticado
Identidade: Microsoft Entra ID
Dados: SharePoint Lists, Dataverse ou SQL
Relatórios: Power BI
Hospedagem: Azure Static Web Apps / App Service / infraestrutura corporativa

Esta v1 foi criada para demonstrar o sistema funcionando fora do Power Apps.


VERSÃO 1.1
----------
- Subcategoria de desvio alterada para lista suspensa.
- Lista de subcategorias muda automaticamente conforme a categoria selecionada.


VERSÃO 1.2
----------
- Logo oficial da Manetoni adicionado ao topo.
- Registro de evidência fotográfica no cadastro do desvio.
- Em celulares compatíveis, o seletor pode abrir diretamente a câmera traseira.
- Até 3 fotos por desvio nesta versão.
- Imagens são comprimidas antes do armazenamento.
- Evidências aparecem no detalhe do desvio e podem ser ampliadas ao tocar/clicar.

Observação:
Como esta versão ainda utiliza localStorage, fotos em excesso podem atingir o limite de armazenamento do navegador.
Na versão corporativa, as evidências devem ser gravadas em armazenamento central (SharePoint/Azure/Dataverse).


VERSÃO 1.3 - PREPARADA PARA INTRANET
-------------------------------------
Objetivo:
- Publicação em uma pasta própria dentro do servidor da intranet Manetoni.
- Todos os arquivos usam caminhos relativos.
- Compatível com HTTPS.
- Mantém captura/seleção de evidência fotográfica.
- Mantém estrutura PWA.
- Adiciona diagnóstico simples do ambiente em Indicadores.

Estrutura para publicação:
conferencia_cargas/
  index.html
  app.js
  styles.css
  manifest.json
  sw.js
  logo-manetoni.png
  README.txt

Recomendação:
Copiar a pasta conferencia_cargas inteira para o servidor da intranet sem misturar
os arquivos com o diretório da página atual do SGQ.


VERSÃO 1.4 - PDF + COMPARTILHAMENTO
-----------------------------------
- Ao encerrar uma carga como CONFORME, o relatório PDF é gerado para visualização.
- O PDF contém:
  * identificação da carga;
  * pedido, placa, motorista e responsável;
  * início e conclusão;
  * resultado final;
  * resumo de desvios;
  * detalhes dos desvios;
  * tratativas;
  * evidências fotográficas;
  * histórico;
  * identificação/rodapé por página.
- Botões:
  * VISUALIZAR PDF
  * COMPARTILHAR
  * SALVAR PDF
- No iPhone, o botão COMPARTILHAR utiliza a Web Share API quando suportada,
  permitindo escolher WhatsApp, Mail, Arquivos e outros apps disponíveis.
- A biblioteca jsPDF é carregada por CDN (cdnjs 2.5.1).

IMPORTANTE PARA O TESTE:
- O smartphone precisa acessar a aplicação por HTTPS.
- O acesso ao CDN do jsPDF deve estar liberado na rede.
- O compartilhamento de arquivo depende do suporte do Safari/iOS ao Web Share API.
Publicação externa Vercel - v1.4
