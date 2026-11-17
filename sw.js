// Service worker do Ronda Obstétrica: app offline. Ao mudar qualquer arquivo, aumente a VERSAO.
const VERSAO = 'ronda-v2-4';
// Fontes do Google: cache próprio, sem versão (só guarda fontes; sobrevive a atualizações do app).
const CACHE_FONTES = 'ronda-fontes';
const ARQUIVOS = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'js/app.js',
  'js/pwa.js',
  'js/nucleo/alertas.js',
  'js/nucleo/calculadoras.js',
  'js/nucleo/contexto.js',
  'js/nucleo/datacao.js',
  'js/nucleo/datas.js',
  'js/nucleo/diagnosticos.js',
  'js/nucleo/estado.js',
  'js/nucleo/faixas.js',
  'js/nucleo/medicacoes.js',
  'js/nucleo/mudancas.js',
  'js/nucleo/pendencias.js',
  'js/nucleo/regras.js',
  'js/nucleo/sugestoes.js',
  'js/nucleo/textoregras.js',
  'js/relatorios/comum.js',
  'js/relatorios/ficha.js',
  'js/relatorios/planilha.js',
  'js/relatorios/texto.js',
  'js/ui/calculadoras.js',
  'js/ui/cartao.js',
  'js/ui/censo.js',
  'js/ui/compartilhar.js',
  'js/ui/dados.js',
  'js/ui/formularios.js',
  'js/ui/hoje.js',
  'js/ui/imprimir.js',
  'js/ui/paciente.js',
  'js/ui/pendform.js',
  'js/ui/plantao.js',
  'js/ui/programacao.js',
  'js/ui/protocolos.js',
  'js/ui/util.js',
  'vendor/xlsx.mini.min.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-512-maskable.png',
  'icons/apple-touch-icon.png',
];

const ehFonte = (url) => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

self.addEventListener('install', (ev) => {
  // Sem skipWaiting aqui: a versão nova espera a usuária tocar no aviso.
  ev.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil((async () => {
    for (const nome of await caches.keys()) {
      if (nome !== VERSAO && nome !== CACHE_FONTES) await caches.delete(nome);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (ev) => {
  if (ev.data && ev.data.tipo === 'skipWaiting') self.skipWaiting();
});

// `cobrir(promessa)` registra o trabalho de fundo; o fetch chama waitUntil antes de qualquer await.
async function fonte(req, cobrir) {
  const cache = await caches.open(CACHE_FONTES);
  const guardado = await cache.match(req);
  const rede = fetch(req).then((r) => {
    if (r && (r.ok || r.type === 'opaque')) cache.put(req, r.clone()).catch(() => {});
    return r;
  }).catch(() => undefined);
  cobrir(rede);
  if (guardado) return guardado;
  return (await rede) || Response.error(); // offline sem cache: o CSS cai no system-ui
}

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (ehFonte(url)) {
    let cobrir;
    const coberto = new Promise((ok) => { cobrir = (p) => ok(Promise.resolve(p).catch(() => {})); });
    ev.waitUntil(coberto);
    ev.respondWith(fonte(req, cobrir).catch(() => { cobrir(); return Response.error(); }));
    return;
  }
  if (url.origin !== self.location.origin) return;
  ev.respondWith((async () => {
    const cache = await caches.open(VERSAO);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try { return await fetch(req); } catch (e) {
      if (req.mode === 'navigate') {
        const idx = await cache.match('index.html');
        if (idx) return idx;
      }
      return Response.error();
    }
  })());
});
