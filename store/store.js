// store.js — MEMPHY store SPA: grid / product / info views, cart drawer,
// dark mode, loader. No frameworks, no page reloads.
(function () {
  var CUR = '€'; // EUR

  var PRODUCTS = [
    {
      id: 'chain',
      name: 'Memphy nameplate chain',
      price: 120,
      img: 'img/chain.jpg',
      sizes: ['40 CM', '45 CM'],
      status: '',
      desc: [
        'gold-plated script nameplate on a curb chain',
        'lobster clasp, made to order',
        'comes in a memphy dust pouch',
      ],
    },
    {
      id: 'tank',
      name: 'Camo M tank',
      price: 45,
      img: 'img/tank.jpg',
      sizes: ['S', 'M', 'L', 'XL'],
      status: 'SOLD OUT',
      desc: [
        'ribbed heavyweight cotton tank',
        'embroidered camo M crest patch',
        'cut slim — size up for a looser fit',
      ],
    },
    {
      id: 'knuckles',
      name: 'Memphy knuckles',
      price: 160,
      img: 'img/knuckles.jpg',
      sizes: [],
      status: '',
      desc: [
        'solid brass script four-finger ring',
        'polished mirror finish',
        'decorative piece — heavy, wear responsibly',
      ],
    },
    {
      id: 'sticker',
      name: 'Chrome emblem sticker',
      price: 6,
      img: 'img/sticker.jpg',
      sizes: [],
      status: '',
      desc: [
        'die-cut vinyl, 10 cm wide',
        'weatherproof — car, case, decks',
      ],
    },
  ];

  var money = function (n) { return CUR + n.toFixed(2).replace(/\.00$/, ''); };

  // ---------------------------------------------------------------- state
  var cart = []; // {id, size, qty}
  var current = null; // product shown in detail view
  var selSize = null;
  var qty = 1;

  // ---------------------------------------------------------------- els
  var $ = function (s) { return document.querySelector(s); };
  var views = {
    home: $('#view-home'),
    product: $('#view-product'),
    info: $('#view-info'),
  };

  // ---------------------------------------------------------------- loader
  (function loader() {
    document.body.classList.add('loading');
    var brand = $('#loaderBrand');
    'MEMPHY'.split('').forEach(function (ch, i) {
      var s = document.createElement('span');
      s.textContent = ch;
      s.style.animationDelay = (i * 0.07) + 's';
      brand.appendChild(s);
    });
    var bar = $('#loaderBar span');
    var p = 0;
    var trickle = setInterval(function () {
      p = Math.min(p + Math.random() * 18, 88);
      bar.style.width = p + '%';
    }, 180);
    var t0 = Date.now();
    var finish = function () {
      clearInterval(trickle);
      bar.style.width = '100%';
      var wait = Math.max(0, 1600 - (Date.now() - t0));
      setTimeout(function () {
        $('#loader').classList.add('done');
        document.body.classList.remove('loading');
      }, wait + 250);
    };
    if (document.readyState === 'complete') finish();
    else addEventListener('load', finish);
  })();

  // ---------------------------------------------------------------- dark mode
  (function mode() {
    var saved = null;
    try { saved = localStorage.getItem('memphy-theme'); } catch (e) {}
    if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    $('#modeToggle').addEventListener('click', function () {
      var el = document.documentElement;
      var dark = el.getAttribute('data-theme') === 'dark';
      if (dark) el.removeAttribute('data-theme');
      else el.setAttribute('data-theme', 'dark');
      try { localStorage.setItem('memphy-theme', dark ? 'light' : 'dark'); } catch (e) {}
    });
  })();

  // ---------------------------------------------------------------- nav
  function show(name) {
    var out = document.querySelector('.view:not([hidden])');
    var target = views[name];
    if (out === target) return;
    if (out) {
      out.classList.add('fading');
      setTimeout(function () {
        out.hidden = true;
        out.classList.remove('fading');
        target.hidden = false;
        target.classList.add('fading');
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { target.classList.remove('fading'); });
        });
        scrollTo(0, 0);
      }, 300);
    } else {
      target.hidden = false;
    }
    $('#mainnav').classList.remove('open');
  }

  document.querySelectorAll('[data-nav]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      show(a.dataset.nav);
    });
  });
  $('#burger').addEventListener('click', function () {
    $('#mainnav').classList.toggle('open');
  });
  $('#login').addEventListener('click', function (e) { e.preventDefault(); });

  // ---------------------------------------------------------------- grid
  (function grid() {
    var g = $('#grid');
    PRODUCTS.forEach(function (p) {
      var card = document.createElement('div');
      card.className = 'card';
      card.innerHTML =
        '<img src="' + p.img + '" alt="' + p.name + '" loading="lazy">' +
        '<div class="cname">' + p.name + '</div>' +
        '<div class="cprice">' + (p.status ? p.status : money(p.price)) + '</div>';
      card.addEventListener('click', function () { openProduct(p); });
      g.appendChild(card);
    });
  })();

  // ---------------------------------------------------------------- product
  function openProduct(p) {
    current = p;
    selSize = null;
    qty = 1;
    $('#pImage').src = p.img;
    $('#pImage').alt = p.name;
    $('#pName').textContent = p.name;
    $('#pPrice').textContent = money(p.price);
    $('#pStatus').textContent = p.status || '';
    $('#qtyVal').textContent = qty;
    var sizes = $('#pSizes');
    sizes.innerHTML = '';
    p.sizes.forEach(function (s) {
      var b = document.createElement('button');
      b.className = 'pill';
      b.textContent = s;
      b.addEventListener('click', function () {
        selSize = s;
        sizes.querySelectorAll('.pill').forEach(function (o) { o.classList.remove('sel'); });
        b.classList.add('sel');
      });
      sizes.appendChild(b);
    });
    var desc = $('#pDesc');
    desc.innerHTML = '';
    p.desc.forEach(function (d) {
      var li = document.createElement('li');
      li.textContent = d;
      desc.appendChild(li);
    });
    $('#addBtn').disabled = !!p.status;
    $('#addBtn').textContent = p.status ? p.status : 'ADD TO CART';
    show('product');
  }

  $('#backBtn').addEventListener('click', function () { show('home'); });

  // image zoom follows cursor
  (function zoom() {
    var wrap = $('#pImageWrap'), img = $('#pImage');
    wrap.addEventListener('mousemove', function (e) {
      var r = wrap.getBoundingClientRect();
      var x = ((e.clientX - r.left) / r.width) * 100;
      var y = ((e.clientY - r.top) / r.height) * 100;
      img.style.transformOrigin = x + '% ' + y + '%';
      img.style.transform = 'scale(2)';
    });
    wrap.addEventListener('mouseleave', function () {
      img.style.transform = '';
    });
  })();

  $('#qtyMinus').addEventListener('click', function () {
    qty = Math.max(1, qty - 1);
    $('#qtyVal').textContent = qty;
  });
  $('#qtyPlus').addEventListener('click', function () {
    qty = Math.min(9, qty + 1);
    $('#qtyVal').textContent = qty;
  });

  $('#addBtn').addEventListener('click', function () {
    if (!current || current.status) return;
    if (current.sizes.length && !selSize) {
      $('#pSizes').querySelectorAll('.pill').forEach(function (b) {
        b.style.borderColor = 'var(--red)';
        setTimeout(function () { b.style.borderColor = ''; }, 900);
      });
      return;
    }
    var key = current.id + '/' + (selSize || '-');
    var line = cart.find(function (l) { return l.key === key; });
    if (line) line.qty = Math.min(9, line.qty + qty);
    else cart.push({ key: key, id: current.id, size: selSize, qty: qty });
    updateCart();
    show('home');
    openCart();
  });

  // ---------------------------------------------------------------- cart
  var cartEl = $('#cart'), overlay = $('#overlay');

  function openCart() {
    cartEl.hidden = false;
    overlay.hidden = false;
    requestAnimationFrame(function () {
      cartEl.classList.add('open');
      overlay.classList.add('open');
    });
  }
  function closeCart() {
    cartEl.classList.remove('open');
    overlay.classList.remove('open');
    setTimeout(function () { cartEl.hidden = true; overlay.hidden = true; }, 350);
  }
  $('#cartBtn').addEventListener('click', openCart);
  $('#cartClose').addEventListener('click', closeCart);
  overlay.addEventListener('click', closeCart);
  addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !cartEl.hidden) closeCart();
  });

  function updateCart() {
    var count = cart.reduce(function (a, l) { return a + l.qty; }, 0);
    $('#cartCount').textContent = count;
    var box = $('#cartItems');
    box.innerHTML = '';
    if (!cart.length) {
      box.innerHTML = '<div class="cart-empty">YOUR CART IS EMPTY</div>';
    }
    var subtotal = 0;
    cart.forEach(function (l) {
      var p = PRODUCTS.find(function (x) { return x.id === l.id; });
      subtotal += p.price * l.qty;
      var it = document.createElement('div');
      it.className = 'citem';
      it.innerHTML =
        '<img src="' + p.img + '" alt="">' +
        '<div><div class="ciname">' + p.name + '</div>' +
        (l.size ? '<div class="cisize">' + l.size + '</div>' : '') +
        '<div class="ciqty"><button data-d="-1">&minus;</button><span>' + l.qty +
        '</span><button data-d="1">+</button></div>' +
        '<a class="cirm" href="#">remove</a></div>' +
        '<div class="ciprice">' + money(p.price * l.qty) + '</div>';
      it.querySelectorAll('.ciqty button').forEach(function (b) {
        b.addEventListener('click', function () {
          l.qty = Math.max(1, Math.min(9, l.qty + parseInt(b.dataset.d, 10)));
          updateCart();
        });
      });
      it.querySelector('.cirm').addEventListener('click', function (e) {
        e.preventDefault();
        cart = cart.filter(function (x) { return x !== l; });
        updateCart();
      });
      box.appendChild(it);
    });
    $('#subtotalVal').textContent = money(subtotal);
  }
  updateCart();

  $('#checkoutBtn').addEventListener('click', function () {
    if (!cart.length) return;
    var lines = cart.map(function (l) {
      var p = PRODUCTS.find(function (x) { return x.id === l.id; });
      return l.qty + 'x ' + p.name + (l.size ? ' (' + l.size + ')' : '') +
        ' — ' + money(p.price * l.qty);
    });
    var subtotal = $('#subtotalVal').textContent;
    location.href = 'mailto:orders@memphy.co?subject=' +
      encodeURIComponent('MEMPHY order') + '&body=' +
      encodeURIComponent('hi, i want to order:\n\n' + lines.join('\n') +
        '\n\nsubtotal: ' + subtotal + '\n\nname:\naddress:\n');
  });
})();
