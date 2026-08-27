// ============================================================
// MANETONI | CONFERÊNCIA DE CARGAS
// v1.5 - SUPABASE
// ============================================================

const APP_VERSION = '1.5';

const SUPABASE_URL =
  'https://jdwdtsbwoerjcgauykdk.supabase.co';

const SUPABASE_KEY =
  'sb_publishable_Qee2-O8RMWTVDAEWTAjbjg_e0uucMkR';


// ============================================================
// SUPABASE
// ============================================================

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);


// ============================================================
// ESTADO DA APLICAÇÃO
// ============================================================

let db = {
  conferencias: []
};

let route = 'home';
let currentId = null;
let sessaoAtual = null;


// ============================================================
// FILA DE SINCRONIZAÇÃO
//
// Evita duas gravações simultâneas quando o usuário realiza
// ações rapidamente.
// ============================================================

let filaSincronizacao = Promise.resolve();


function now() {
  return new Date().toISOString();
}


function fmt(d) {

  if (!d) return '-';

  return new Date(d).toLocaleString(
    'pt-BR',
    {
      dateStyle: 'short',
      timeStyle: 'short'
    }
  );
}


function byId(id) {

  return db.conferencias.find(
    c => c.id === Number(id)
  );
}


// ============================================================
// OBJETOS PARA O BANCO
// ============================================================

function dadosConferencia(c) {

  const dados = { ...c };

  delete dados._dbid;
  delete dados.desvios;

  return dados;
}


function dadosDesvio(d) {

  const dados = { ...d };

  delete dados._dbid;
  delete dados.tratativas;

  return dados;
}


function dadosTratativa(t) {

  const dados = { ...t };

  delete dados._dbid;

  return dados;
}


// ============================================================
// CARREGAR BANCO
// ============================================================

async function carregarBanco() {

  const {
    data: conferenciasBanco,
    error: erroConferencias
  } = await supabaseClient
    .from('conferencias')
    .select('id,dados,criado_em,atualizado_em')
    .order('criado_em', { ascending: true });


  if (erroConferencias) {
    throw erroConferencias;
  }


  const {
    data: desviosBanco,
    error: erroDesvios
  } = await supabaseClient
    .from('desvios')
    .select('id,conferencia_id,dados,criado_em,atualizado_em')
    .order('criado_em', { ascending: true });


  if (erroDesvios) {
    throw erroDesvios;
  }


  const {
    data: tratativasBanco,
    error: erroTratativas
  } = await supabaseClient
    .from('tratativas')
    .select('id,desvio_id,dados,criado_em,atualizado_em')
    .order('criado_em', { ascending: true });


  if (erroTratativas) {
    throw erroTratativas;
  }


  const tratativasPorDesvio = {};


  (tratativasBanco || []).forEach(row => {

    if (!tratativasPorDesvio[row.desvio_id]) {
      tratativasPorDesvio[row.desvio_id] = [];
    }

    tratativasPorDesvio[row.desvio_id].push({
      ...row.dados,
      _dbid: row.id
    });

  });


  const desviosPorConferencia = {};


  (desviosBanco || []).forEach(row => {

    if (!desviosPorConferencia[row.conferencia_id]) {
      desviosPorConferencia[row.conferencia_id] = [];
    }

    desviosPorConferencia[row.conferencia_id].push({
      ...row.dados,
      _dbid: row.id,
      tratativas: tratativasPorDesvio[row.id] || []
    });

  });


  db.conferencias = (conferenciasBanco || []).map(row => ({
    ...row.dados,
    _dbid: row.id,
    desvios: desviosPorConferencia[row.id] || []
  }));

}


// ============================================================
// SINCRONIZAÇÃO
// ============================================================

function save() {

  filaSincronizacao =
    filaSincronizacao
      .then(() => sincronizarBanco())
      .catch(erro => {

        console.error(
          'Erro de sincronização:',
          erro
        );

        alert(
          'Não foi possível sincronizar os dados com o servidor.\n\n' +
          erro.message
        );

      });

  return filaSincronizacao;
}


async function sincronizarBanco() {

  for (const c of db.conferencias) {

    // --------------------------------------------------------
    // CONFERÊNCIA
    // --------------------------------------------------------

    if (!c._dbid) {

      const {
        data,
        error
      } = await supabaseClient
        .from('conferencias')
        .insert({
          dados: dadosConferencia(c)
        })
        .select('id')
        .single();


      if (error) {
        throw error;
      }


      c._dbid = data.id;

    } else {

      const {
        error
      } = await supabaseClient
        .from('conferencias')
        .update({
          dados: dadosConferencia(c)
        })
        .eq('id', c._dbid);


      if (error) {
        throw error;
      }

    }


    // --------------------------------------------------------
    // DESVIOS
    // --------------------------------------------------------

    for (const d of (c.desvios || [])) {

      if (!d._dbid) {

        const {
          data,
          error
        } = await supabaseClient
          .from('desvios')
          .insert({
            conferencia_id: c._dbid,
            dados: dadosDesvio(d)
          })
          .select('id')
          .single();


        if (error) {
          throw error;
        }


        d._dbid = data.id;

      } else {

        const {
          error
        } = await supabaseClient
          .from('desvios')
          .update({
            dados: dadosDesvio(d)
          })
          .eq('id', d._dbid);


        if (error) {
          throw error;
        }

      }


      // ------------------------------------------------------
      // TRATATIVAS
      // ------------------------------------------------------

      for (const t of (d.tratativas || [])) {

        if (!t._dbid) {

          const {
            data,
            error
          } = await supabaseClient
            .from('tratativas')
            .insert({
              desvio_id: d._dbid,
              dados: dadosTratativa(t)
            })
            .select('id')
            .single();


          if (error) {
            throw error;
          }


          t._dbid = data.id;

        } else {

          const {
            error
          } = await supabaseClient
            .from('tratativas')
            .update({
              dados: dadosTratativa(t)
            })
            .eq('id', t._dbid);


          if (error) {
            throw error;
          }

        }

      }

    }

  }

}


// ============================================================
// AUTENTICAÇÃO
// ============================================================

function mostrarLogin(mensagem = '') {

  const app =
    document.querySelector('#app');

  const nav =
    document.querySelector('.bottom-nav');

  const btnHome =
    document.querySelector('#btnHome');


  if (nav) {
    nav.style.display = 'none';
  }

  if (btnHome) {
    btnHome.style.display = 'none';
  }


  app.innerHTML = `

    <div class="eyebrow">
      Acesso
    </div>

    <h1>
      Conferência de Cargas
    </h1>

    <div class="grid">

      <div class="card span-12">

        <h2>
          Entrar
        </h2>

        <div class="muted">
          Utilize seu usuário autorizado para acessar
          as conferências.
        </div>

        ${
          mensagem
            ? `<div class="dangerbox"
                    style="margin-top:12px">
                 ${mensagem}
               </div>`
            : ''
        }

        <div class="field"
             style="margin-top:16px">

          <label>
            E-mail
          </label>

          <input
            id="loginEmail"
            type="email"
            autocomplete="username"
          >

        </div>

        <div class="field">

          <label>
            Senha
          </label>

          <input
            id="loginSenha"
            type="password"
            autocomplete="current-password"
          >

        </div>

        <button
          class="primary"
          id="btnEntrar"
          type="button"
        >
          ENTRAR
        </button>

      </div>

    </div>
  `;


  const entrar =
    document.querySelector('#btnEntrar');


  entrar.onclick =
    realizarLogin;


  document
    .querySelector('#loginSenha')
    .addEventListener(
      'keydown',
      e => {

        if (e.key === 'Enter') {
          realizarLogin();
        }

      }
    );

}


async function realizarLogin() {

  const email =
    document
      .querySelector('#loginEmail')
      .value
      .trim();


  const senha =
    document
      .querySelector('#loginSenha')
      .value;


  if (!email || !senha) {

    mostrarLogin(
      'Informe e-mail e senha.'
    );

    return;

  }


  const btn =
    document.querySelector('#btnEntrar');


  btn.disabled = true;
  btn.textContent = 'ENTRANDO...';


  const {
    data,
    error
  } = await supabaseClient
    .auth
    .signInWithPassword({
      email,
      password: senha
    });


  if (error) {

    mostrarLogin(
      'E-mail ou senha inválidos.'
    );

    return;

  }


  sessaoAtual =
    data.session;


  await iniciarAreaAutenticada();

}


async function logout() {

  if (
    !confirm(
      'Deseja sair do aplicativo?'
    )
  ) {
    return;
  }


  await supabaseClient
    .auth
    .signOut();


  sessaoAtual = null;

  db = {
    conferencias: []
  };


  route = 'home';
  currentId = null;


  mostrarLogin();

}


// ============================================================
// INICIALIZAÇÃO
// ============================================================

async function iniciarApp() {

  try {

    const {
      data
    } = await supabaseClient
      .auth
      .getSession();


    sessaoAtual =
      data.session;


    if (!sessaoAtual) {

      mostrarLogin();

      return;

    }


    await iniciarAreaAutenticada();

  } catch (erro) {

    console.error(erro);

    mostrarLogin(
      'Não foi possível iniciar o aplicativo.'
    );

  }

}


async function iniciarAreaAutenticada() {

  const app =
    document.querySelector('#app');


  app.innerHTML = `

    <div class="card">

      <h2>
        Carregando...
      </h2>

      <div class="muted">
        Sincronizando conferências.
      </div>

    </div>
  `;


  try {

    await carregarBanco();

    const nav =
      document.querySelector('.bottom-nav');

    const btnHome =
      document.querySelector('#btnHome');


    if (nav) {
      nav.style.display = '';
    }

    if (btnHome) {
      btnHome.style.display = '';
    }


    route = 'home';
    currentId = null;

    render();

  } catch (erro) {

    console.error(erro);

    app.innerHTML = `

      <div class="dangerbox">

        Não foi possível carregar o banco de dados.

        <br><br>

        ${erro.message}

      </div>
    `;

  }

}


// ============================================================
// IMAGENS
// ============================================================

function fileToCompressedDataURL(
  file,
  maxWidth = 1280,
  quality = .75
) {

  return new Promise(
    (resolve, reject) => {

      const reader =
        new FileReader();


      reader.onerror =
        reject;


      reader.onload = () => {

        const img =
          new Image();


        img.onerror =
          reject;


        img.onload = () => {

          let w =
            img.width;

          let h =
            img.height;


          if (w > maxWidth) {

            h =
              Math.round(
                h * (maxWidth / w)
              );

            w =
              maxWidth;

          }


          const canvas =
            document
              .createElement(
                'canvas'
              );


          canvas.width = w;
          canvas.height = h;


          canvas
            .getContext('2d')
            .drawImage(
              img,
              0,
              0,
              w,
              h
            );


          resolve(
            canvas.toDataURL(
              'image/jpeg',
              quality
            )
          );

        };


        img.src =
          reader.result;

      };


      reader.readAsDataURL(
        file
      );

    }
  );

}


// ============================================================
// PDF
// ============================================================

async function gerarPdfBlob(c) {

  if (
    !window.jspdf ||
    !window.jspdf.jsPDF
  ) {

    throw new Error(
      'Biblioteca de PDF não carregada. Verifique o acesso à internet/CDN.'
    );

  }


  const {
    jsPDF
  } = window.jspdf;


  const doc =
    new jsPDF({
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait'
    });


  const W = 210;
  const H = 297;
  const ML = 14;
  const MR = 14;
  const usable = W - ML - MR;

  let y = 14;


  function pageCheck(
    extra = 10
  ) {

    if (
      y + extra >
      H - 16
    ) {

      doc.addPage();

      y = 16;

    }

  }


  function line(
    label,
    value,
    x = ML,
    w = usable
  ) {

    pageCheck(8);

    doc.setFont(
      'helvetica',
      'bold'
    );

    doc.setFontSize(9);

    doc.text(
      label,
      x,
      y
    );


    doc.setFont(
      'helvetica',
      'normal'
    );


    const off =
      Math.min(
        48,
        doc.getTextWidth(label) + 3
      );


    const lines =
      doc.splitTextToSize(
        String(
          value ?? '-'
        ),
        w - off
      );


    doc.text(
      lines,
      x + off,
      y
    );


    y +=
      Math.max(
        6,
        lines.length * 4.5
      );

  }


  function section(title) {

    pageCheck(12);

    y += 2;


    doc.setFillColor(
      30,
      30,
      30
    );


    doc.rect(
      ML,
      y,
      usable,
      7,
      'F'
    );


    doc.setTextColor(
      255,
      255,
      255
    );


    doc.setFont(
      'helvetica',
      'bold'
    );


    doc.setFontSize(10);


    doc.text(
      title,
      ML + 3,
      y + 4.8
    );


    doc.setTextColor(
      20,
      20,
      20
    );


    y += 11;

  }


  function paragraph(text) {

    pageCheck(10);

    doc.setFont(
      'helvetica',
      'normal'
    );


    doc.setFontSize(9);


    const lines =
      doc.splitTextToSize(
        String(
          text || '-'
        ),
        usable
      );


    doc.text(
      lines,
      ML,
      y
    );


    y +=
      lines.length * 4.5 + 2;

  }


  async function addPhoto(
    dataUrl,
    label
  ) {

    if (!dataUrl) {
      return;
    }


    try {

      pageCheck(62);


      doc.setFont(
        'helvetica',
        'bold'
      );


      doc.setFontSize(8);


      doc.text(
        label,
        ML,
        y
      );


      y += 3;


      const maxW = 82;
      const maxH = 52;


      doc.addImage(
        dataUrl,
        'JPEG',
        ML,
        y,
        maxW,
        maxH,
        undefined,
        'FAST'
      );


      y +=
        maxH + 5;


    } catch (e) {

      paragraph(
        '[Não foi possível inserir esta evidência no PDF]'
      );

    }

  }


  try {

    const img =
      document.querySelector(
        '.brand-logo'
      );


    if (
      img &&
      img.complete
    ) {

      const canvas =
        document.createElement(
          'canvas'
        );


      canvas.width =
        img.naturalWidth;


      canvas.height =
        img.naturalHeight;


      const ctx =
        canvas.getContext('2d');


      ctx.drawImage(
        img,
        0,
        0
      );


      const logoData =
        canvas.toDataURL(
          'image/png'
        );


      doc.addImage(
        logoData,
        'PNG',
        ML,
        y,
        34,
        20,
        undefined,
        'FAST'
      );

    }

  } catch (e) {}


  doc.setFont(
    'helvetica',
    'bold'
  );


  doc.setFontSize(17);


  doc.text(
    'RELATÓRIO DE CONFERÊNCIA DE CARGA',
    55,
    y + 8
  );


  doc.setFontSize(9);


  doc.setFont(
    'helvetica',
    'normal'
  );


  doc.text(
    `Manetoni | Conferência de Cargas | v${APP_VERSION}`,
    55,
    y + 14
  );


  doc.setDrawColor(
    200,
    16,
    46
  );


  doc.setLineWidth(1.2);


  doc.line(
    ML,
    y + 23,
    W - MR,
    y + 23
  );


  y += 31;


  section(
    'IDENTIFICAÇÃO'
  );


  line(
    'Carga:',
    c.carga
  );

  line(
    'Pedido:',
    c.pedido
  );

  line(
    'Placa:',
    c.placa || '-'
  );

  line(
    'Motorista:',
    c.motorista || '-'
  );

  line(
    'Responsável:',
    c.responsavel || '-'
  );

  line(
    'Início:',
    fmt(c.inicio)
  );

  line(
    'Conclusão:',
    fmt(c.fim)
  );

  line(
    'Resultado:',
    c.status
  );


  section(
    'RESUMO'
  );


  line(
    'Desvios registrados:',
    c.desvios.length
  );


  line(
    'Desvios tratados:',
    c.desvios.filter(
      d => d.status === 'TRATADO'
    ).length
  );


  line(
    'Desvios pendentes:',
    c.desvios.filter(
      d => d.status !== 'TRATADO'
    ).length
  );


  if (c.desvios.length) {

    section(
      'DESVIOS E TRATATIVAS'
    );


    for (
      let i = 0;
      i < c.desvios.length;
      i++
    ) {

      const d =
        c.desvios[i];


      pageCheck(30);


      doc.setFont(
        'helvetica',
        'bold'
      );


      doc.setFontSize(11);


      doc.text(
        `Desvio ${String(i + 1).padStart(2, '0')}`,
        ML,
        y
      );


      y += 6;


      line(
        'Categoria:',
        d.categoria
      );

      line(
        'Subcategoria:',
        d.subcategoria
      );

      line(
        'Pedido:',
        d.pedido || '-'
      );

      line(
        'Quantidade:',
        d.quantidade || '-'
      );

      line(
        'Ação:',
        d.acao || '-'
      );


      doc.setFont(
        'helvetica',
        'bold'
      );


      doc.setFontSize(9);


      doc.text(
        'Observação:',
        ML,
        y
      );


      y += 4;


      paragraph(
        d.observacao || '-'
      );


      if (
        d.tratativas &&
        d.tratativas.length
      ) {

        doc.setFont(
          'helvetica',
          'bold'
        );


        doc.setFontSize(9);


        doc.text(
          'Tratativas:',
          ML,
          y
        );


        y += 5;


        d.tratativas.forEach(
          (t, idx) => {

            pageCheck(15);


            doc.setFont(
              'helvetica',
              'bold'
            );


            doc.setFontSize(8);


            doc.text(
              `${idx + 1}. ${fmt(t.data)} - ${t.acao}`,
              ML + 3,
              y
            );


            y += 4;


            doc.setFont(
              'helvetica',
              'normal'
            );


            const tl =
              doc.splitTextToSize(
                t.observacao || '-',
                usable - 6
              );


            doc.text(
              tl,
              ML + 3,
              y
            );


            y +=
              tl.length * 4 + 3;

          }
        );

      }


      if (
        d.evidencias &&
        d.evidencias.length
      ) {

        doc.setFont(
          'helvetica',
          'bold'
        );


        doc.setFontSize(9);


        pageCheck(8);


        doc.text(
          'Evidências fotográficas:',
          ML,
          y
        );


        y += 5;


        for (
          let j = 0;
          j < d.evidencias.length;
          j++
        ) {

          await addPhoto(
            d.evidencias[j],
            `Foto ${j + 1}`
          );

        }

      }


      doc.setDrawColor(
        220,
        220,
        220
      );


      doc.line(
        ML,
        y,
        W - MR,
        y
      );


      y += 6;

    }

  }


  section(
    'HISTÓRICO DA CONFERÊNCIA'
  );


  (c.historico || []).forEach(
    h => {

      pageCheck(12);


      doc.setFont(
        'helvetica',
        'bold'
      );


      doc.setFontSize(8);


      doc.text(
        `${fmt(h.data)} - ${h.evento}`,
        ML,
        y
      );


      y += 4;


      doc.setFont(
        'helvetica',
        'normal'
      );


      const lines =
        doc.splitTextToSize(
          h.detalhe || '',
          usable
        );


      if (lines.length) {

        doc.text(
          lines,
          ML,
          y
        );


        y +=
          lines.length * 4;

      }


      y += 2;

    }
  );


  const pages =
    doc.getNumberOfPages();


  for (
    let p = 1;
    p <= pages;
    p++
  ) {

    doc.setPage(p);


    doc.setFont(
      'helvetica',
      'normal'
    );


    doc.setFontSize(7);


    doc.setTextColor(
      100,
      100,
      100
    );


    doc.text(
      `Manetoni | Conferência ${c.carga} | ID ${c.id} | Página ${p}/${pages}`,
      ML,
      H - 8
    );


    doc.setTextColor(
      20,
      20,
      20
    );

  }


  return doc.output(
    'blob'
  );

}


function nomeArquivoPdf(c) {

  const carga =
    String(
      c.carga || 'carga'
    )
      .replace(
        /[^a-zA-Z0-9_-]/g,
        '_'
      );


  return `Conferencia_Carga_${carga}_${c.id}.pdf`;

}


async function compartilharPdf(c) {

  try {

    const blob =
      await gerarPdfBlob(c);


    const file =
      new File(
        [blob],
        nomeArquivoPdf(c),
        {
          type: 'application/pdf'
        }
      );


    if (
      navigator.share &&
      (
        !navigator.canShare ||
        navigator.canShare({
          files: [file]
        })
      )
    ) {

      await navigator.share({
        title:
          `Conferência de Carga ${c.carga}`,
        text:
          `Relatório da conferência da carga ${c.carga}.`,
        files:
          [file]
      });

    } else {

      baixarPdfBlob(
        blob,
        nomeArquivoPdf(c)
      );


      alert(
        'O compartilhamento direto de arquivo não está disponível neste navegador. O PDF foi aberto/salvo para compartilhamento manual.'
      );

    }

  } catch (err) {

    alert(
      'Não foi possível compartilhar o PDF: ' +
      err.message
    );

  }

}


function baixarPdfBlob(
  blob,
  nome
) {

  const url =
    URL.createObjectURL(blob);


  const a =
    document.createElement('a');


  a.href =
    url;


  a.download =
    nome;


  document.body.appendChild(a);

  a.click();

  a.remove();


  setTimeout(
    () =>
      URL.revokeObjectURL(url),
    30000
  );

}


async function salvarPdf(c) {

  try {

    const blob =
      await gerarPdfBlob(c);


    baixarPdfBlob(
      blob,
      nomeArquivoPdf(c)
    );

  } catch (err) {

    alert(
      'Não foi possível gerar o PDF: ' +
      err.message
    );

  }

}


async function visualizarPdf(c) {

  try {

    const blob =
      await gerarPdfBlob(c);


    const url =
      URL.createObjectURL(blob);


    modal(
      'Relatório da conferência',
      `

      <iframe
        class="pdf-frame"
        src="${url}"
        title="Relatório PDF">
      </iframe>

      <div class="pdf-actions">

        <button
          class="primary"
          id="pdfCompartilhar">
          COMPARTILHAR
        </button>

        <button
          class="dark"
          id="pdfSalvar">
          SALVAR PDF
        </button>

        <button
          class="light"
          id="pdfAbrir">
          ABRIR PDF
        </button>

      </div>

      <div class="camera-hint">
        No iPhone, Compartilhar deve abrir a folha nativa
        do iOS quando o navegador oferecer suporte ao
        compartilhamento de arquivos.
      </div>
      `
    );


    document
      .querySelector(
        '#pdfCompartilhar'
      )
      .onclick =
        () =>
          compartilharPdf(c);


    document
      .querySelector(
        '#pdfSalvar'
      )
      .onclick =
        () =>
          salvarPdf(c);


    document
      .querySelector(
        '#pdfAbrir'
      )
      .onclick =
        () =>
          window.open(
            url,
            '_blank'
          );


  } catch (err) {

    alert(
      'Não foi possível gerar o PDF: ' +
      err.message
    );

  }

}


// ============================================================
// INTERFACE
// ============================================================

function badge(status) {

  const s =
    status || '';


  let cls =
    s.includes('CONFORME')
      ? 'conforme'
      : s.includes('REAB')
      ? 'reaberta'
      : s.includes('TRAT') ||
        s.includes('DESVIO')
      ? 'desvio'
      : 'andamento';


  return `
    <span class="status ${cls}">
      ${s}
    </span>
  `;

}


function activeNav() {

  document
    .querySelectorAll(
      '.bottom-nav button'
    )
    .forEach(
      b =>
        b.classList.toggle(
          'active',
          b.dataset.nav === route
        )
    );

}


function render() {

  activeNav();


  const app =
    document.querySelector(
      '#app'
    );


  if (route === 'home') {
    app.innerHTML = home();
  }


  if (route === 'andamento') {
    app.innerHTML =
      listAndamento();
  }


  if (route === 'historico') {
    app.innerHTML =
      historico();
  }


  if (route === 'indicadores') {
    app.innerHTML =
      indicadores();
  }


  if (route === 'detalhe') {
    app.innerHTML =
      detalhe(currentId);
  }


  bind();

}


// ============================================================
// HOME
// ============================================================

function home() {

  const andamento =
    db.conferencias.filter(
      c => !c.fim
    );


  const hojeISO =
    new Date()
      .toISOString()
      .slice(0, 10);


  const hoje =
    db.conferencias.filter(
      c =>
        c.inicio &&
        c.inicio.slice(0, 10) ===
          hojeISO
    );


  const desvios =
    hoje.reduce(
      (a, c) =>
        a + c.desvios.length,
      0
    );


  return `

    <div class="eyebrow">
      Operação
    </div>

    <h1>
      Conferência de Cargas
    </h1>

    <div class="grid">

      <div class="card span-12">

        <h2>
          Iniciar nova conferência
        </h2>

        <div class="muted">
          Abra uma carga e registre a conferência
          diretamente pelo celular.
        </div>

        <div class="actions">

          <button
            class="primary"
            id="nova">
            + INICIAR CONFERÊNCIA
          </button>

        </div>

      </div>


      <div class="card span-4">

        <div class="muted">
          Em andamento
        </div>

        <div class="metric">
          ${andamento.length}
        </div>

      </div>


      <div class="card span-4">

        <div class="muted">
          Conferências hoje
        </div>

        <div class="metric">
          ${hoje.length}
        </div>

      </div>


      <div class="card span-4">

        <div class="muted">
          Desvios hoje
        </div>

        <div class="metric">
          ${desvios}
        </div>

      </div>


      <div class="card span-12">

        <div class="row">

          <div>

            <h2>
              Cargas abertas
            </h2>

            <div class="muted">
              Retome qualquer processo sem perder
              a referência.
            </div>

          </div>

        </div>


        <div
          class="list"
          style="margin-top:12px">

          ${
            andamento.length
              ? andamento
                  .map(cardCarga)
                  .join('')
              : `
                <div class="okbox">
                  Nenhuma carga em andamento.
                </div>
              `
          }

        </div>

      </div>

    </div>
  `;

}


function cardCarga(c) {

  return `

    <div class="item">

      <div class="row">

        <div>

          <b>
            Carga ${c.carga}
          </b>

          <div class="muted">
            Pedido ${c.pedido || '-'}
            ·
            ${fmt(c.inicio)}
          </div>

        </div>

        ${badge(c.status)}

      </div>


      <div
        class="muted"
        style="margin-top:8px">

        ${c.desvios.length}
        desvio(s) registrado(s)

      </div>


      <div class="actions">

        <button
          class="dark abrir"
          data-id="${c.id}">
          ABRIR
        </button>

      </div>

    </div>
  `;

}


// ============================================================
// EM ANDAMENTO
// ============================================================

function listAndamento() {

  const xs =
    db.conferencias.filter(
      c => !c.fim
    );


  return `

    <div class="eyebrow">
      Controle
    </div>

    <h1>
      Em andamento
    </h1>

    <div class="list">

      ${
        xs.length
          ? xs
              .map(cardCarga)
              .join('')
          : `
            <div class="okbox">
              Nenhuma conferência aberta.
            </div>
          `
      }

    </div>
  `;

}


// ============================================================
// HISTÓRICO
// ============================================================

function historico() {

  const xs =
    [...db.conferencias]
      .sort(
        (a, b) =>
          b.id - a.id
      );


  return `

    <div class="eyebrow">
      Rastreabilidade
    </div>

    <h1>
      Histórico
    </h1>

    <div class="list">

      ${
        xs.map(
          c => `

            <div class="item">

              <div class="row">

                <div>

                  <b>
                    Carga ${c.carga}
                  </b>

                  <div class="muted">
                    ${fmt(c.inicio)}
                    ·
                    ${c.responsavel}
                  </div>

                </div>

                ${badge(c.status)}

              </div>


              <div class="actions">

                <button
                  class="light abrir"
                  data-id="${c.id}">
                  DETALHES
                </button>

              </div>

            </div>
          `
        ).join('')
      }

    </div>
  `;

}


// ============================================================
// INDICADORES
// ============================================================

function indicadores() {

  const total =
    db.conferencias.length;


  const finalizadas =
    db.conferencias.filter(
      c => c.fim
    ).length;


  const desvios =
    db.conferencias.reduce(
      (a, c) =>
        a + c.desvios.length,
      0
    );


  const conformes =
    db.conferencias.filter(
      c =>
        c.status ===
        'CONFORME'
    ).length;


  const taxa =
    total
      ? (
          (
            conformes /
            total
          ) * 100
        ).toFixed(1)
      : '0.0';


  const secure =
    window.isSecureContext;


  const cameraCapable =
    !!(
      navigator.mediaDevices &&
      navigator.mediaDevices
        .getUserMedia
    );


  const email =
    sessaoAtual?.user?.email ||
    '-';


  return `

    <div class="eyebrow">
      Gestão
    </div>

    <h1>
      Indicadores
    </h1>

    <div class="grid">

      <div class="card span-4">

        <div class="muted">
          Conferências
        </div>

        <div class="metric">
          ${total}
        </div>

      </div>


      <div class="card span-4">

        <div class="muted">
          Finalizadas
        </div>

        <div class="metric">
          ${finalizadas}
        </div>

      </div>


      <div class="card span-4">

        <div class="muted">
          Desvios
        </div>

        <div class="metric">
          ${desvios}
        </div>

      </div>


      <div class="card span-6">

        <div class="muted">
          Cargas conformes
        </div>

        <div class="metric">
          ${conformes}
        </div>

      </div>


      <div class="card span-6">

        <div class="muted">
          Índice simples de conformidade
        </div>

        <div class="metric">
          ${taxa}%
        </div>

      </div>


      <div class="card span-12">

        <h2>
          Ambiente
        </h2>

        <div class="muted">
          Versão ${APP_VERSION}
          ·
          ${location.hostname}
        </div>

        <div
          class="okbox"
          style="margin-top:10px">

          Banco central Supabase ativo.

        </div>


        <div
          style="margin-top:10px">

          ${
            secure
              ? `
                <div class="okbox">
                  HTTPS / contexto seguro ativo.
                </div>
              `
              : `
                <div class="notice">
                  Contexto não seguro.
                </div>
              `
          }

        </div>


        <div
          style="margin-top:10px">

          ${
            cameraCapable
              ? `
                <div class="okbox">
                  Navegador com suporte de mídia detectado.
                </div>
              `
              : `
                <div class="notice">
                  API de mídia não detectada.
                </div>
              `
          }

        </div>

      </div>


      <div class="card span-12">

        <h2>
          Sessão
        </h2>

        <div class="muted">
          Usuário conectado
        </div>

        <div style="margin-top:6px">
          <b>
            ${email}
          </b>
        </div>

        <div class="actions">

          <button
            class="light"
            id="btnSair">
            SAIR
          </button>

        </div>

      </div>

    </div>
  `;

}


// ============================================================
// DETALHE
// ============================================================

function detalhe(id) {

  const c =
    byId(id);


  if (!c) {

    return `
      <div class="dangerbox">
        Registro não encontrado.
      </div>
    `;

  }


  return `

    <div class="eyebrow">
      Carga ${c.carga}
    </div>

    <h1>
      Conferência
    </h1>

    <div class="grid">

      <div class="card span-12">

        <div class="row">

          <div>

            <h2>
              Carga ${c.carga}
            </h2>

            <div class="muted">
              Início ${fmt(c.inicio)}
              ·
              ${c.responsavel}
            </div>

          </div>

          ${badge(c.status)}

        </div>

        <hr>


        <div class="grid">

          <div class="span-4">

            <div class="muted">
              Pedido
            </div>

            <b>
              ${c.pedido || '-'}
            </b>

          </div>


          <div class="span-4">

            <div class="muted">
              Placa
            </div>

            <b>
              ${c.placa || '-'}
            </b>

          </div>


          <div class="span-4">

            <div class="muted">
              Motorista
            </div>

            <b>
              ${c.motorista || '-'}
            </b>

          </div>

        </div>


        ${
          !c.fim
            ? `

              <div class="actions">

                <button
                  class="primary"
                  id="novoDesvio">

                  + REGISTRAR DESVIO

                </button>


                <button
                  class="dark"
                  id="encerrarConforme">

                  CARGA CONFORME

                </button>

              </div>

            `
            : ''
        }

      </div>


      ${
        c.fim
          ? `

            <div
              class="card span-12 report-card">

              <h2>
                Relatório da conferência
              </h2>

              <div class="muted">

                A conferência está encerrada.
                Gere o PDF para visualizar,
                salvar ou compartilhar.

              </div>


              <div class="pdf-actions">

                <button
                  class="primary"
                  id="visualizarPdf">

                  VISUALIZAR PDF

                </button>


                <button
                  class="dark"
                  id="compartilharPdf">

                  COMPARTILHAR

                </button>


                <button
                  class="light"
                  id="salvarPdf">

                  SALVAR PDF

                </button>

              </div>

            </div>
          `
          : ''
      }


      <div class="card span-12">

        <h2>
          Desvios
        </h2>

        <div class="list">

          ${
            c.desvios.length
              ? c.desvios
                  .map(
                    (d, i) => `

                      <div class="item">

                        <div class="row">

                          <div>

                            <b>
                              ${d.categoria}
                              ·
                              ${d.subcategoria}
                            </b>

                            <div class="muted">
                              Pedido ${d.pedido || '-'}
                              ·
                              ${d.quantidade || '-'}
                            </div>

                          </div>

                          ${
                            badge(
                              d.status === 'TRATADO'
                                ? 'CONFORME'
                                : 'AGUARDANDO TRATATIVA'
                            )
                          }

                        </div>


                        <div
                          style="margin-top:8px">

                          ${d.observacao}

                        </div>


                        <div
                          class="muted"
                          style="margin-top:6px">

                          Ação:
                          ${d.acao || '-'}

                        </div>


                        ${
                          (
                            d.evidencias &&
                            d.evidencias.length
                          )
                            ? `

                              <div class="evidence-grid">

                                ${
                                  d.evidencias
                                    .map(
                                      (img, j) => `

                                        <img
                                          src="${img}"
                                          alt="Evidência ${j + 1}"
                                          class="evidencia-img"
                                          data-src="${img}">

                                      `
                                    )
                                    .join('')
                                }

                              </div>
                            `
                            : ''
                        }


                        <div class="actions">

                          <button
                            class="light tratar"
                            data-index="${i}">

                            ${
                              d.status === 'TRATADO'
                                ? 'NOVA TRATATIVA'
                                : 'TRATAR DESVIO'
                            }

                          </button>

                        </div>

                      </div>
                    `
                  )
                  .join('')
              : `

                <div class="okbox">
                  Nenhum desvio registrado.
                </div>

              `
          }

        </div>

      </div>


      <div class="card span-12">

        <h2>
          Histórico da carga
        </h2>

        <div class="timeline">

          ${
            (c.historico || [])
              .map(
                h => `

                  <div class="timeline-entry">

                    <b>
                      ${h.evento}
                    </b>

                    <div class="muted">

                      ${fmt(h.data)}
                      ·
                      ${h.detalhe || ''}

                    </div>

                  </div>
                `
              )
              .join('')
          }

        </div>

      </div>

    </div>
  `;

}


// ============================================================
// MODAL
// ============================================================

function modal(
  title,
  body
) {

  const t =
    document
      .querySelector(
        '#modalTemplate'
      )
      .content
      .cloneNode(true);


  t.querySelector(
    '#modalTitle'
  ).textContent =
    title;


  t.querySelector(
    '#modalBody'
  ).innerHTML =
    body;


  document.body.appendChild(t);


  document
    .querySelector(
      '#modalClose'
    )
    .onclick =
      () =>
        document
          .querySelector(
            '.modal-backdrop'
          )
          .remove();

}


// ============================================================
// NOVA CONFERÊNCIA
// ============================================================

function novaModal() {

  modal(
    'Nova conferência',
    `

      <div class="field">

        <label>
          Carga *
        </label>

        <input id="fCarga">

      </div>


      <div class="field">

        <label>
          Pedido *
        </label>

        <input id="fPedido">

      </div>


      <div class="field">

        <label>
          Placa
        </label>

        <input id="fPlaca">

      </div>


      <div class="field">

        <label>
          Motorista
        </label>

        <input id="fMotorista">

      </div>


      <div class="field">

        <label>
          Responsável *
        </label>

        <input
          id="fResp"
          value="Operador">

      </div>


      <button
        class="primary"
        id="salvarNova">

        INICIAR CONFERÊNCIA

      </button>
    `
  );


  document
    .querySelector(
      '#salvarNova'
    )
    .onclick =
      async () => {


        const carga =
          document
            .querySelector(
              '#fCarga'
            )
            .value
            .trim();


        const pedido =
          document
            .querySelector(
              '#fPedido'
            )
            .value
            .trim();


        const resp =
          document
            .querySelector(
              '#fResp'
            )
            .value
            .trim();


        if (
          !carga ||
          !pedido ||
          !resp
        ) {

          alert(
            'Preencha Carga, Pedido e Responsável.'
          );

          return;

        }


        const id =
          Date.now();


        db.conferencias.push({

          id,

          carga,

          pedido,

          placa:
            document
              .querySelector(
                '#fPlaca'
              )
              .value
              .trim(),

          motorista:
            document
              .querySelector(
                '#fMotorista'
              )
              .value
              .trim(),

          responsavel:
            resp,

          inicio:
            now(),

          fim:
            null,

          status:
            'EM ANDAMENTO',

          observacao:
            '',

          desvios:
            [],

          historico: [
            {
              data:
                now(),

              evento:
                'Conferência iniciada',

              detalhe:
                `Carga ${carga}`
            }
          ]

        });


        await save();


        document
          .querySelector(
            '.modal-backdrop'
          )
          .remove();


        currentId =
          id;


        route =
          'detalhe';


        render();

      };

}


// ============================================================
// DESVIOS
// ============================================================

const subcategoriasDesvio = {

  Material: [
    'Material avariado',
    'Material oxidado',
    'Material fora de especificação',
    'Material incorreto',
    'Outro'
  ],

  Identificação: [
    'Etiqueta ausente',
    'Etiqueta ilegível',
    'Etiqueta incorreta',
    'Material sem identificação',
    'Outro'
  ],

  Quantidade: [
    'Quantidade a maior',
    'Quantidade a menor',
    'Quantidade divergente',
    'Volume divergente',
    'Outro'
  ],

  Documentação: [
    'Pedido divergente',
    'Romaneio divergente',
    'Documento ausente',
    'Informação incorreta',
    'Outro'
  ],

  Carregamento: [
    'Material não carregado',
    'Material carregado indevidamente',
    'Posicionamento inadequado',
    'Amarração/segregação inadequada',
    'Outro'
  ],

  Outro: [
    'Outro'
  ]

};


function atualizarSubcategorias() {

  const cat =
    document.querySelector(
      '#dCat'
    );


  const sub =
    document.querySelector(
      '#dSub'
    );


  if (
    !cat ||
    !sub
  ) {
    return;
  }


  const itens =
    subcategoriasDesvio[
      cat.value
    ] || ['Outro'];


  sub.innerHTML =
    '<option value="">Selecione...</option>' +

    itens
      .map(
        x =>
          `<option value="${x}">${x}</option>`
      )
      .join('');

}


function desvioModal() {

  const conferencia =
    byId(currentId);


  modal(
    'Registrar desvio',
    `

      <div class="field">

        <label>
          Categoria *
        </label>

        <select id="dCat">

          <option value="">
            Selecione...
          </option>

          <option>
            Material
          </option>

          <option>
            Identificação
          </option>

          <option>
            Quantidade
          </option>

          <option>
            Documentação
          </option>

          <option>
            Carregamento
          </option>

          <option>
            Outro
          </option>

        </select>

      </div>


      <div class="field">

        <label>
          Subcategoria *
        </label>

        <select id="dSub">
        </select>

      </div>


      <div class="field">

        <label>
          Pedido *
        </label>

        <input
          id="dPed"
          value="${conferencia.pedido || ''}">

      </div>


      <div class="field">

        <label>
          Quantidade envolvida *
        </label>

        <input id="dQtd">

      </div>


      <div class="field">

        <label>
          Observação *
        </label>

        <textarea id="dObs">
        </textarea>

      </div>


      <div class="field">

        <label>
          Ação executada *
        </label>

        <select id="dAcao">

          <option>
            Material segregado
          </option>

          <option>
            Recontagem realizada
          </option>

          <option>
            Reidentificado
          </option>

          <option>
            Corrigido no carregamento
          </option>

          <option>
            Aguardando Qualidade
          </option>

          <option>
            Outro
          </option>

        </select>

      </div>


      <div class="field">

        <label>
          Evidência fotográfica
        </label>

        <input
          id="dFoto"
          type="file"
          accept="image/*"
          capture="environment"
          multiple>

        <div class="camera-hint">

          No celular, use a câmera para fotografar
          a evidência. Também é possível escolher
          imagens já salvas.

        </div>

        <div
          id="fotoPreview"
          class="photo-preview-grid">
        </div>

      </div>


      <button
        class="primary"
        id="salvarDesvio">

        SALVAR DESVIO

      </button>
    `
  );


  document
    .querySelector(
      '#dCat'
    )
    .addEventListener(
      'change',
      atualizarSubcategorias
    );


  atualizarSubcategorias();


  let fotosSelecionadas =
    [];


  document
    .querySelector(
      '#dFoto'
    )
    .addEventListener(
      'change',
      async e => {

        const files =
          [...e.target.files]
            .slice(0, 3);


        fotosSelecionadas =
          [];


        const preview =
          document.querySelector(
            '#fotoPreview'
          );


        preview.innerHTML =
          '<div class="muted">Processando foto(s)...</div>';


        try {

          for (
            const f of files
          ) {

            fotosSelecionadas.push(
              await fileToCompressedDataURL(
                f
              )
            );

          }


          preview.innerHTML =
            fotosSelecionadas
              .map(
                (x, i) =>
                  `<img src="${x}" alt="Prévia ${i + 1}">`
              )
              .join('');


        } catch (err) {

          preview.innerHTML =
            '<div class="dangerbox">Não foi possível processar a imagem.</div>';

        }

      }
    );


  document
    .querySelector(
      '#salvarDesvio'
    )
    .onclick =
      async () => {

        const dCat =
          document.querySelector(
            '#dCat'
          );


        const dSub =
          document.querySelector(
            '#dSub'
          );


        const dPed =
          document.querySelector(
            '#dPed'
          );


        const dQtd =
          document.querySelector(
            '#dQtd'
          );


        const dObs =
          document.querySelector(
            '#dObs'
          );


        const dAcao =
          document.querySelector(
            '#dAcao'
          );


        if (
          !dCat.value ||
          !dSub.value ||
          !dPed.value.trim() ||
          !dQtd.value.trim() ||
          !dObs.value.trim()
        ) {

          alert(
            'Preencha todos os campos obrigatórios.'
          );

          return;

        }


        const c =
          byId(
            currentId
          );


        c.desvios.push({

          id:
            Date.now(),

          categoria:
            dCat.value,

          subcategoria:
            dSub.value.trim(),

          pedido:
            dPed.value.trim(),

          quantidade:
            dQtd.value.trim(),

          observacao:
            dObs.value.trim(),

          acao:
            dAcao.value,

          status:
            'ABERTO',

          tratativas:
            [],

          evidencias:
            fotosSelecionadas

        });


        c.status =
          'AGUARDANDO TRATATIVA';


        c.historico.push({

          data:
            now(),

          evento:
            'Desvio registrado',

          detalhe:
            dSub.value.trim()

        });


        await save();


        document
          .querySelector(
            '.modal-backdrop'
          )
          .remove();


        render();

      };

}


// ============================================================
// TRATATIVA
// ============================================================

function tratarModal(i) {

  const c =
    byId(currentId);


  const d =
    c.desvios[i];


  modal(
    'Tratativa do desvio',
    `

      <div class="notice">

        <b>
          ${d.categoria}
          ·
          ${d.subcategoria}
        </b>

        <br>

        ${d.observacao}

      </div>

      <br>


      <div class="field">

        <label>
          Nova ação *
        </label>

        <select id="tAcao">

          <option>
            Material liberado pela Qualidade
          </option>

          <option>
            Material segregado
          </option>

          <option>
            Recontagem realizada
          </option>

          <option>
            Reidentificado
          </option>

          <option>
            Correção concluída
          </option>

          <option>
            Outro
          </option>

        </select>

      </div>


      <div class="field">

        <label>
          Observação da tratativa *
        </label>

        <textarea id="tObs">
        </textarea>

      </div>


      <div class="actions">

        <button
          class="primary"
          id="salvarTrat">

          SALVAR TRATATIVA

        </button>


        <button
          class="dark"
          id="tratarConcluir">

          TRATAR E CONCLUIR

        </button>

      </div>
    `
  );


  document
    .querySelector(
      '#salvarTrat'
    )
    .onclick =
      () =>
        salvaTrat(false);


  document
    .querySelector(
      '#tratarConcluir'
    )
    .onclick =
      () =>
        salvaTrat(true);


  async function salvaTrat(
    concluir
  ) {

    const tObs =
      document.querySelector(
        '#tObs'
      );


    const tAcao =
      document.querySelector(
        '#tAcao'
      );


    if (
      !tObs.value.trim()
    ) {

      alert(
        'Informe a observação da tratativa.'
      );

      return;

    }


    d.tratativas.push({

      data:
        now(),

      acao:
        tAcao.value,

      observacao:
        tObs.value.trim()

    });


    d.acao =
      tAcao.value;


    if (concluir) {

      d.status =
        'TRATADO';

    }


    c.historico.push({

      data:
        now(),

      evento:
        concluir
          ? 'Desvio tratado'
          : 'Tratativa registrada',

      detalhe:
        `${d.subcategoria}: ${tAcao.value}`

    });


    if (
      c.desvios.every(
        x =>
          x.status ===
          'TRATADO'
      )
    ) {

      c.status =
        'EM ANDAMENTO';

    }


    await save();


    document
      .querySelector(
        '.modal-backdrop'
      )
      .remove();


    render();

  }

}


// ============================================================
// ENCERRAMENTO
// ============================================================

async function encerrar() {

  const c =
    byId(currentId);


  const pend =
    c.desvios.filter(
      d =>
        d.status !==
        'TRATADO'
    );


  if (pend.length) {

    alert(
      `Existem ${pend.length} desvio(s) pendente(s). Conclua as tratativas antes de finalizar.`
    );

    return;

  }


  if (
    !confirm(
      'Confirmar que a carga está conforme e encerrar a conferência?'
    )
  ) {
    return;
  }


  c.status =
    'CONFORME';


  c.fim =
    now();


  c.historico.push({

    data:
      now(),

    evento:
      'Carga validada como conforme',

    detalhe:
      'Conferência encerrada'

  });


  await save();


  render();


  setTimeout(
    () =>
      visualizarPdf(c),
    150
  );

}


// ============================================================
// EVENTOS
// ============================================================

function bind() {

  document
    .querySelectorAll(
      '[data-nav]'
    )
    .forEach(
      b =>
        b.onclick =
          () => {

            route =
              b.dataset.nav;

            currentId =
              null;

            render();

          }
    );


  const btnHome =
    document.querySelector(
      '#btnHome'
    );


  if (btnHome) {

    btnHome.onclick =
      () => {

        route =
          'home';

        currentId =
          null;

        render();

      };

  }


  document
    .querySelectorAll(
      '.abrir'
    )
    .forEach(
      b =>
        b.onclick =
          () => {

            currentId =
              b.dataset.id;

            route =
              'detalhe';

            render();

          }
    );


  const nova =
    document.querySelector(
      '#nova'
    );


  if (nova) {
    nova.onclick =
      novaModal;
  }


  const novoDesvio =
    document.querySelector(
      '#novoDesvio'
    );


  if (novoDesvio) {
    novoDesvio.onclick =
      desvioModal;
  }


  const encerrarConforme =
    document.querySelector(
      '#encerrarConforme'
    );


  if (encerrarConforme) {
    encerrarConforme.onclick =
      encerrar;
  }


  const visualizar =
    document.querySelector(
      '#visualizarPdf'
    );


  if (visualizar) {

    visualizar.onclick =
      () =>
        visualizarPdf(
          byId(currentId)
        );

  }


  const compartilhar =
    document.querySelector(
      '#compartilharPdf'
    );


  if (compartilhar) {

    compartilhar.onclick =
      () =>
        compartilharPdf(
          byId(currentId)
        );

  }


  const salvar =
    document.querySelector(
      '#salvarPdf'
    );


  if (salvar) {

    salvar.onclick =
      () =>
        salvarPdf(
          byId(currentId)
        );

  }


  const sair =
    document.querySelector(
      '#btnSair'
    );


  if (sair) {
    sair.onclick =
      logout;
  }


  document
    .querySelectorAll(
      '.tratar'
    )
    .forEach(
      b =>
        b.onclick =
          () =>
            tratarModal(
              Number(
                b.dataset.index
              )
            )
    );


  document
    .querySelectorAll(
      '.evidencia-img'
    )
    .forEach(
      img =>
        img.onclick =
          () => {

            modal(
              'Evidência fotográfica',
              `

                <img
                  src="${img.dataset.src}"
                  alt="Evidência"
                  style="
                    width:100%;
                    height:auto;
                    border-radius:12px;
                  ">

              `
            );

          }
    );

}


// ============================================================
// SERVICE WORKER
// ============================================================

if (
  'serviceWorker'
  in navigator
) {

  window.addEventListener(
    'load',
    () => {

      navigator
        .serviceWorker
        .register(
          'sw.js'
        )
        .catch(
          () => {}
        );

    }
  );

}


// ============================================================
// ALTERAÇÃO DA SESSÃO
// ============================================================

supabaseClient
  .auth
  .onAuthStateChange(
    (
      event,
      session
    ) => {

      sessaoAtual =
        session;

    }
  );


// ============================================================
// START
// ============================================================

iniciarApp();
