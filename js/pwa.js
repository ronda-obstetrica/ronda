// Registro do service worker e aviso de nova versão. Carregado só pelo navegador (index.html).
const botao = document.getElementById('atualizar');
let tocou = false;

function oferecer(sw) {
  if (!botao) return;
  botao.hidden = false;
  botao.onclick = () => { tocou = true; botao.disabled = true; sw.postMessage({ tipo: 'skipWaiting' }); };
}

if ('serviceWorker' in navigator) {
  let recarregou = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Só recarrega depois do toque no aviso (a primeira instalação não recarrega).
    if (!tocou || recarregou) return;
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
