/* SoftShop — interacciones de UI (sin dependencias) */
(function () {
  'use strict';

  var reduced =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- header condensado + barra de progreso + parallax del hero ---- */
  var hdr = document.querySelector('.hdr');
  var bar = document.querySelector('.progress');
  var heroTx = document.querySelector('.hero .wrap');

  function onScroll() {
    var y = window.scrollY || document.documentElement.scrollTop;
    if (hdr) hdr.classList.toggle('is-stuck', y > 12);
    if (bar) {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, y / h) : 0) + ')';
    }
    // El texto del hero se va un poco más lento que la escena del fondo.
    if (heroTx && !reduced) {
      var p = Math.min(1, y / (window.innerHeight * 0.85));
      heroTx.style.transform = 'translate3d(0,' + p * 64 + 'px,0)';
      heroTx.style.opacity = String(1 - p * 0.9);
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---- menú móvil ---- */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.nav');

  function cerrarMenu() {
    if (!nav || !toggle) return;
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  }

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') cerrarMenu();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        cerrarMenu();
        toggle.focus();
      }
    });
  }

  /* ---- desplegable de productos ----
     En escritorio se abre al pasar el mouse y también con un clic, para
     quien navega con teclado. En el celular va siempre desplegado: no
     hay lugar para un panel flotante y esconderlo solo agrega un toque. */
  var btnProd = document.querySelector('.nav-btn');
  var panelProd = document.getElementById('menu-productos');

  if (btnProd && panelProd) {
    var cajaProd = btnProd.parentNode;
    var cierre;

    function enEscritorio() {
      return window.matchMedia('(min-width: 1001px)').matches;
    }

    function abrirProductos(abierto) {
      btnProd.setAttribute('aria-expanded', String(abierto));
      if (abierto) panelProd.removeAttribute('hidden');
      else panelProd.setAttribute('hidden', '');
    }

    function ajustarAlAncho() {
      // en celular queda desplegado y sin el atributo hidden, para que los
      // lectores de pantalla lo anuncien igual que lo ve el resto
      if (!enEscritorio()) abrirProductos(true);
      else abrirProductos(false);
    }
    ajustarAlAncho();
    window.addEventListener('resize', ajustarAlAncho, { passive: true });

    btnProd.addEventListener('click', function () {
      if (!enEscritorio()) return;
      abrirProductos(btnProd.getAttribute('aria-expanded') !== 'true');
    });

    cajaProd.addEventListener('pointerenter', function () {
      if (!enEscritorio()) return;
      clearTimeout(cierre);
      abrirProductos(true);
    });

    cajaProd.addEventListener('pointerleave', function () {
      if (!enEscritorio()) return;
      cierre = setTimeout(function () {
        abrirProductos(false);
      }, 220);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && btnProd.getAttribute('aria-expanded') === 'true' && enEscritorio()) {
        abrirProductos(false);
        btnProd.focus();
      }
    });

    document.addEventListener('click', function (e) {
      if (enEscritorio() && !cajaProd.contains(e.target)) abrirProductos(false);
    });

    cajaProd.addEventListener('focusout', function (e) {
      if (enEscritorio() && !cajaProd.contains(e.relatedTarget)) abrirProductos(false);
    });
  }

  /* ---- titulares que entran palabra por palabra ----
     Solo se parten los nodos de texto sueltos. Los elementos hijos
     (por ejemplo el tramo con degradado) viajan enteros, para no
     romperles el recorte del fondo sobre el texto. */
  function partirEnPalabras(el) {
    var piezas = [];

    Array.prototype.forEach.call(el.childNodes, function (n) {
      if (n.nodeType === 3) {
        n.textContent.split(/(\s+)/).forEach(function (tok) {
          if (!tok) return;
          if (!tok.trim()) {
            piezas.push(document.createTextNode(tok));
            return;
          }
          var envoltura = document.createElement('span');
          envoltura.className = 'w';
          var interior = document.createElement('span');
          interior.textContent = tok;
          envoltura.appendChild(interior);
          piezas.push(envoltura);
        });
      } else if (n.nodeType === 1) {
        var caja = document.createElement('span');
        caja.className = 'w';
        caja.appendChild(n.cloneNode(true));
        piezas.push(caja);
      }
    });

    while (el.firstChild) el.removeChild(el.firstChild);
    piezas.forEach(function (p) {
      el.appendChild(p);
    });

    Array.prototype.forEach.call(el.querySelectorAll('.w'), function (w, i) {
      w.style.setProperty('--wd', i * 60 + 'ms');
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll('.split'), partirEnPalabras);

  /* ---- revelado al entrar en pantalla ---- */
  var revealables = document.querySelectorAll('.rv, .split');
  if (!('IntersectionObserver' in window) || reduced) {
    Array.prototype.forEach.call(revealables, function (el) {
      el.classList.add('is-in');
    });
  } else {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add('is-in');
            io.unobserve(en.target);
          }
        });
      },
      // Umbral en cero: alcanza con que asome un píxel. Con un umbral
      // proporcional, un bloque alto podía cruzar la pantalla sin llegar
      // nunca a cumplirlo y quedarse invisible para siempre.
      { rootMargin: '0px 0px -40px 0px', threshold: 0 }
    );
    /* Escalonado por grupo, de verdad: el retardo se calcula por la
       posición del elemento ENTRE SUS HERMANOS con revelado, no por su
       lugar en la lista global. Con un contador global, el primero de un
       grupo podía heredar el retardo más largo y entrar último; el orden
       dependía de cuántos elementos hubiera antes en la página, que no
       es una decisión de diseño. */
    Array.prototype.forEach.call(revealables, function (el) {
      if (!el.style.getPropertyValue('--d')) {
        var hermanos = el.parentNode ? el.parentNode.children : [];
        var puesto = 0;
        for (var k = 0; k < hermanos.length; k++) {
          if (hermanos[k] === el) break;
          if (hermanos[k].classList && hermanos[k].classList.contains('rv')) puesto++;
        }
        el.style.setProperty('--d', Math.min(puesto, 5) * 80 + 'ms');
      }
      io.observe(el);
    });

    /* Red de seguridad: si algo quedó atrás sin revelarse —por un scroll
       muy rápido, por un salto con un ancla o por volver desde otra
       página— se revela igual. Nada puede quedar en blanco. */
    var pendientes = Array.prototype.slice.call(revealables);
    function barrerAtrasados() {
      if (!pendientes.length) return;
      pendientes = pendientes.filter(function (el) {
        if (el.classList.contains('is-in')) return false;
        if (el.getBoundingClientRect().top < window.innerHeight) {
          el.classList.add('is-in');
          io.unobserve(el);
          return false;
        }
        return true;
      });
    }
    window.addEventListener('scroll', barrerAtrasados, { passive: true });
    window.addEventListener('resize', barrerAtrasados, { passive: true });
    setTimeout(barrerAtrasados, 1200);
  }

  /* ---- foco de cursor e inclinación de las tarjetas ---- */
  if (!reduced && window.matchMedia('(hover: hover)').matches) {
    var previa = null;

    function enderezar(el) {
      if (!el) return;
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
    }

    document.addEventListener(
      'pointermove',
      function (e) {
        var caja =
          e.target.closest && e.target.closest('.card, .quote, .pan, .pt-lead, .cta-band');
        if (caja !== previa) {
          enderezar(previa);
          previa = caja;
        }
        if (!caja) return;

        var r = caja.getBoundingClientRect();
        var mx = (e.clientX - r.left) / r.width;
        var my = (e.clientY - r.top) / r.height;
        caja.style.setProperty('--mx', mx * 100 + '%');
        caja.style.setProperty('--my', my * 100 + '%');

        // La inclinación solo se aplica a las piezas chicas.
        if (caja.classList.contains('card') || caja.classList.contains('pan')) {
          caja.style.setProperty('--rx', (0.5 - my) * 5 + 'deg');
          caja.style.setProperty('--ry', (mx - 0.5) * 6 + 'deg');
        }
      },
      { passive: true }
    );
  }

  /* ---- contadores ---- */
  function countUp(el) {
    var end = parseFloat(el.dataset.count);
    var suffix = el.dataset.suffix || '';
    var prefix = el.dataset.prefix || '';
    if (reduced) {
      el.textContent = prefix + end + suffix;
      return;
    }
    var t0 = null;
    var dur = 1400;
    function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + Math.round(end * eased) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  var counters = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window) {
    var co = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            countUp(en.target);
            co.unobserve(en.target);
          }
        });
      },
      { threshold: 0.5 }
    );
    Array.prototype.forEach.call(counters, function (el) {
      co.observe(el);
    });
  } else {
    Array.prototype.forEach.call(counters, countUp);
  }

  /* ---- botón magnético (sutil) ---- */
  if (!reduced && window.matchMedia('(hover: hover)').matches) {
    Array.prototype.forEach.call(document.querySelectorAll('.btn'), function (btn) {
      btn.addEventListener('pointermove', function (e) {
        var r = btn.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        var dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        btn.style.transform =
          'translate(' + dx * 5 + 'px,' + (dy * 5 - 2) + 'px)';
      });
      btn.addEventListener('pointerleave', function () {
        btn.style.transform = '';
      });
    });
  }

  /* ---- formulario de contacto (demo, sin backend) ---- */
  var form = document.querySelector('form[data-demo]');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var note = form.querySelector('.form-note');
      if (note) {
        note.textContent =
          'Maqueta de demostración: el envío todavía no está conectado a un servidor.';
        note.style.color = '#a4700a';
      }
    });
  }

  /* ---- escena 3D ----
     assets/scene.js pesa 523 KB. Se descarga solamente cuando el
     equipo la va a mostrar: si no hay WebGL, si el sistema pide
     movimiento reducido o si la pantalla es angosta, queda el
     degradado de reemplazo y no se baja el archivo. */

  function haySoporteWebGL() {
    try {
      var c = document.createElement('canvas');
      return !!(
        window.WebGLRenderingContext &&
        (c.getContext('webgl') || c.getContext('experimental-webgl'))
      );
    } catch (err) {
      return false;
    }
  }

  function montarEscena() {
    if (!window.SoftshopScene) return;
    Array.prototype.forEach.call(
      document.querySelectorAll('canvas[data-scene]'),
      function (c) {
        window.SoftshopScene.mount(c, { compact: c.dataset.scene === 'compact' });
      }
    );
  }

  function cargarEscena() {
    if (!document.querySelector('canvas[data-scene]')) return;
    if (reduced) return;
    if (window.matchMedia('(max-width: 720px)').matches) return;
    if (!haySoporteWebGL()) return;

    var s = document.createElement('script');
    s.src = 'assets/scene.js';
    s.defer = true;
    s.onload = montarEscena;
    document.head.appendChild(s);
  }

  function arrancar() {
    if (window.requestIdleCallback) requestIdleCallback(cargarEscena, { timeout: 1200 });
    else setTimeout(cargarEscena, 200);
  }

  if (document.readyState === 'complete') arrancar();
  else window.addEventListener('load', arrancar);
})();
