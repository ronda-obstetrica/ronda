// Registro do service worker e aviso de nova versão. Carregado só pelo navegador (index.html).
const botao = document.getElementById('atualizar');

function oferecer(sw) {
  if (!botao) return;
  botao.hidden = false;
  botao.onclick = () => { botao.disabled = true; sw.postMessage({ tipo: 'skipWaiting' }); };
}

if ('serviceWorker' in navigator) {
  const tinhaControlador = !!navigator.serviceWorker.controller;
  let recarregou = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Na primeira instalação (sem controlador antes) não há o que recarregar.
    if (!tinhaControlador || recarregou) return;
    recarregou = true;
    location.reload();
  });
  navigator.serviceWorker.register('sw.js').then((reg) => {
    if (reg.waiting && navigator.serviceWorker.controller) oferecer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const novo = reg.installing;
      novo?.addEventListener('statechange', () => {
        if (novo.state === 'installed' && navigator.serviceWorker.controller) oferecer(novo);
      });
    });
  }).catch((e) => console.warn('Service worker indisponível:', e));
}
