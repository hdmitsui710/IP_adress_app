'use strict';

/* =========================================================
   DNSたんけん — script.js
   ・選んだ名前(FQDN)は、ページ全体で共有される
   ・数字やドメイン名は、すべて説明用の架空のもの
   ========================================================= */
(function () {

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------------------------------------------------------
     データ：名前 → IPアドレス の対応表(架空)
     --------------------------------------------------------- */
  var HOSTS = [
    { fqdn: 'www.example.jp',   ip: '203.0.113.10',  role: 'Webサーバ',    app: 'ブラウザ',     reply: 'ページ' },
    { fqdn: 'mail.example.jp',  ip: '203.0.113.25',  role: 'メールサーバ', app: 'メールソフト', reply: '返事' },
    { fqdn: 'www.example.com',  ip: '198.51.100.20', role: 'Webサーバ',    app: 'ブラウザ',     reply: 'ページ' },
    { fqdn: 'blog.example.com', ip: '198.51.100.30', role: 'Webサーバ',    app: 'ブラウザ',     reply: 'ページ' }
  ];

  HOSTS.forEach(function (h) {
    var p = h.fqdn.split('.');
    h.host = p[0];
    h.org = p[1];
    h.tld = p[2];
    h.domain = p.slice(1).join('.');
  });

  var state = { fqdn: HOSTS[0].fqdn };
  var listeners = [];

  function current() {
    return HOSTS.filter(function (h) { return h.fqdn === state.fqdn; })[0] || HOSTS[0];
  }
  function select(fqdn) {
    if (state.fqdn === fqdn) return;
    state.fqdn = fqdn;
    listeners.forEach(function (fn) { fn(); });
  }
  function onSelect(fn) { listeners.push(fn); }

  /* ---------------------------------------------------------
     名前えらびのチップ(ページ内の複数の場所で共有)
     --------------------------------------------------------- */
  function buildChips() {
    $$('[data-chips]').forEach(function (box) {
      box.innerHTML = HOSTS.map(function (h) {
        return '<button type="button" class="chip" data-fqdn="' + esc(h.fqdn) + '" aria-pressed="false">' + esc(h.fqdn) + '</button>';
      }).join('');
      box.addEventListener('click', function (e) {
        var b = e.target.closest('.chip');
        if (b) select(b.getAttribute('data-fqdn'));
      });
    });
  }
  function syncChips() {
    $$('.chip').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-fqdn') === state.fqdn ? 'true' : 'false');
    });
  }

  /* ---------------------------------------------------------
     ヒーロー：案内板(数字がパタパタ変わる)
     --------------------------------------------------------- */
  var rollToken = 0;

  function rollDigits(el, finalText, animate) {
    var token = ++rollToken;
    if (!animate || reduceMotion) { el.textContent = finalText; return; }
    var chars = finalText.split('');
    var digits = chars.filter(function (c) { return c !== '.'; }).length;
    var k = 0;
    var lock = chars.map(function (c) { return c === '.' ? 0 : 300 + (k++) * (650 / digits); });
    var t0 = performance.now();
    (function tick() {
      if (token !== rollToken) return;
      var t = performance.now() - t0;
      var done = true;
      el.textContent = chars.map(function (c, i) {
        if (c === '.' || t >= lock[i]) return c;
        done = false;
        return String(Math.floor(Math.random() * 10));
      }).join('');
      if (!done) setTimeout(tick, 55);
    })();
  }

  function renderBoard(animate) {
    var h = current();
    $('#boardName').textContent = h.fqdn;
    $('#boardLive').textContent = h.fqdn + ' のIPアドレスは ' + h.ip + ' です。';
    rollDigits($('#boardIp'), h.ip, animate);
  }

  /* ---------------------------------------------------------
     2. 名前の分解 と 対応表
     --------------------------------------------------------- */
  function renderAnatomy() {
    var h = current();
    var octets = h.ip.split('.').map(function (o) {
      return '<span class="oct">' + o + '</span>';
    }).join('<span class="oct-dot">.</span>');

    $('#anatomy').innerHTML =
      '<div class="a-grid" role="img" aria-label="' + esc(h.fqdn) + ' は、ホスト名「' + esc(h.host) +
      '」とドメイン名「' + esc(h.domain) + '」をピリオドでつないだ名前です。">' +
        '<span class="a-text a-host">' + esc(h.host) + '</span>' +
        '<span class="a-dot a-dot1">.</span>' +
        '<span class="a-text a-org">' + esc(h.org) + '</span>' +
        '<span class="a-dot a-dot2">.</span>' +
        '<span class="a-text a-tld">' + esc(h.tld) + '</span>' +
        '<span class="a-br a-br-host">ホスト名</span>' +
        '<span class="a-br a-br-domain">ドメイン名</span>' +
        '<span class="a-sub a-sub-org">組織名</span>' +
        '<span class="a-sub a-sub-tld">TLD</span>' +
      '</div>' +
      '<div class="a-result"><span class="a-eq">DNSで ' + esc(h.fqdn) + ' → </span>' +
        '<span class="octets" aria-label="IPアドレス ' + esc(h.ip) + '">' + octets + '</span></div>';
  }

  function buildMapping() {
    var groups = {};
    var order = [];
    HOSTS.forEach(function (h) {
      if (!groups[h.domain]) { groups[h.domain] = []; order.push(h.domain); }
      groups[h.domain].push(h);
    });
    $('#mapping').innerHTML = order.map(function (dom) {
      return '<section class="dgroup" aria-label="ドメイン名 ' + esc(dom) + '">' +
        '<h3><span class="dg-label">ドメイン名</span><span class="dg-name">' + esc(dom) + '</span></h3>' +
        '<ul>' + groups[dom].map(function (h) {
          return '<li><button type="button" class="row" data-fqdn="' + esc(h.fqdn) + '" aria-pressed="false">' +
            '<span class="r-name"><span class="r-host">' + esc(h.host) + '</span>.' + esc(h.domain) +
              '<span class="r-role">ホスト名「' + esc(h.host) + '」= ' + esc(h.role) + '</span></span>' +
            '<span class="r-arrow" aria-hidden="true">→</span>' +
            '<span class="r-ip">' + esc(h.ip) + '</span>' +
          '</button></li>';
        }).join('') + '</ul></section>';
    }).join('');

    $('#mapping').addEventListener('click', function (e) {
      var b = e.target.closest('.row');
      if (b) select(b.getAttribute('data-fqdn'));
    });
  }
  function syncMapping() {
    $$('#mapping .row').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-fqdn') === state.fqdn ? 'true' : 'false');
    });
  }

  /* ---------------------------------------------------------
     3. DNSの問い合わせシミュレーター
     --------------------------------------------------------- */
  var svg = $('#flow');
  var NODE = {
    pc:   { x: 95,  y: 240 },
    dns:  { x: 460, y: 240 },
    root: { x: 825, y: 70 },
    tld:  { x: 825, y: 240 },
    auth: { x: 825, y: 410 },
    web:  { x: 95,  y: 430 }
  };
  var NW = 150, NH = 84;

  var nodeEl = {};
  Object.keys(NODE).forEach(function (k) { nodeEl[k] = $('[data-node="' + k + '"]', svg); });
  var edgeEls = $$('.edge', svg);

  var packet = $('#packet', svg), pRect = $('#pRect', svg), pText = $('#pText', svg);
  var badge = $('#badge', svg), bRect = $('#bRect', svg), bText = $('#bText', svg);

  var sim = { mode: 'simple', cache: false, steps: [], used: {}, idx: 0 };
  var runToken = 0;
  var playToken = 0;
  var playing = false;

  function textWidth(str, size) {
    var w = 0;
    for (var i = 0; i < str.length; i++) w += str.charCodeAt(i) < 128 ? size * 0.6 : size;
    return w;
  }

  function sortedKey(a, b) { return [a, b].sort().join('-'); }

  function buildSteps(h, mode, cache) {
    var q = '<code>' + esc(h.fqdn) + '</code>';
    var ip = '<code>' + esc(h.ip) + '</code>';
    var steps = [];

    steps.push({
      title: h.app + 'に名前を入力する',
      text: 'あなたが' + h.app + 'で ' + q + ' を使おうとします。でもPCは、名前だけでは相手の場所がわかりません。通信するには、IPアドレス(番号)が必要です。',
      active: ['pc']
    });

    steps.push({
      title: 'DNSサーバに聞く',
      text: 'PCは、設定されているDNSサーバ(キャッシュDNSサーバ)に「' + q + ' のIPアドレスを教えて」と問い合わせます。',
      active: ['pc', 'dns'],
      move: { from: 'pc', to: 'dns', out: 'IPは?' }
    });

    if (cache) {
      steps.push({
        title: '答えを覚えていた!',
        text: 'このDNSサーバは、前に同じ名前を調べたときの答えを覚えています。これが<strong>キャッシュ</strong>です。ほかのDNSサーバに聞かなくてよいので、すぐ答えられます。',
        active: ['dns'], badge: '覚えてた!', pulse: true
      });
    } else if (mode === 'simple') {
      steps.push({
        title: 'DNSサーバが調べる',
        text: 'DNSサーバは答えを覚えていないので、ほかのDNSサーバに聞いて調べます。その様子は「くわしい版」で見られます。',
        active: ['dns'], badge: '調べ中…', pulse: true
      });
    } else {
      steps.push({
        title: 'ルートDNSに聞く',
        text: 'まず、いちばん上の「ルートDNSサーバ」に聞きます。ルートは ' + q + ' の答えは知りませんが、「.' + esc(h.tld) + '」を担当するDNSサーバの場所を教えてくれます。',
        active: ['dns', 'root'],
        move: { from: 'dns', to: 'root', out: 'IPは?', back: '.' + h.tld + 'の場所' }
      });
      steps.push({
        title: '「.' + h.tld + '」担当のDNSに聞く',
        text: '次に「.' + esc(h.tld) + '」を担当するDNSサーバに聞きます。ここも答えは知りませんが、「' + esc(h.domain) + '」を管理しているDNSサーバの場所を教えてくれます。',
        active: ['dns', 'tld'],
        move: { from: 'dns', to: 'tld', out: 'IPは?', back: h.domain + 'の場所' }
      });
      steps.push({
        title: '「' + h.domain + '」の権威DNSに聞く',
        text: '最後に、「' + esc(h.domain) + '」を管理している<strong>権威(けんい)DNSサーバ</strong>に聞きます。ここには ' + q + ' と ' + ip + ' の対応が登録されているので、答えが分かります。',
        active: ['dns', 'auth'],
        move: { from: 'dns', to: 'auth', out: 'IPは?', back: h.ip }
      });
    }

    steps.push({
      title: 'PCに答えを教える',
      text: (cache || mode === 'simple')
        ? 'DNSサーバが ' + ip + ' を教えてくれました。これで、名前とIPアドレスが結びつきました。'
        : 'DNSサーバは、答えの ' + ip + ' をしばらく覚えて(キャッシュして)から、PCに教えます。次に同じ名前を聞かれたら、すぐ答えられます。',
      active: ['dns', 'pc'],
      move: { from: 'dns', to: 'pc', out: h.ip }
    });

    steps.push({
      title: 'IPアドレスで' + h.role + 'につなぐ',
      text: 'PCは、教えてもらった ' + ip + ' あてに通信します。ここからは名前ではなくIPアドレスを使います。' + esc(h.role) + 'から返事が届けば、' + esc(h.app) + 'に表示されます。',
      active: ['pc', 'web'],
      move: { from: 'pc', to: 'web', out: h.ip, back: h.reply },
      web: true
    });

    return steps;
  }

  /* --- パケット(黄色いラベル)の動き --- */
  function legPoints(from, to, label) {
    var A = NODE[from], B = NODE[to];
    var dx = B.x - A.x, dy = B.y - A.y;
    var len = Math.sqrt(dx * dx + dy * dy);
    var ux = dx / len, uy = dy / len;
    var tx = Math.abs(ux) > 1e-6 ? (NW / 2) / Math.abs(ux) : Infinity;
    var ty = Math.abs(uy) > 1e-6 ? (NH / 2) / Math.abs(uy) : Infinity;
    var edge = Math.min(tx, ty);
    var w = textWidth(label, 12) + 22;
    var inset = Math.abs(ux) * w / 2 + Math.abs(uy) * 13 + 6;
    var s = edge + inset;
    var e = len - edge - inset;
    if (e < s) { s = e = len / 2; }
    return { x1: A.x + ux * s, y1: A.y + uy * s, x2: A.x + ux * e, y2: A.y + uy * e };
  }

  function setPacket(label, x, y) {
    var w = textWidth(label, 12) + 22;
    pText.textContent = label;
    pRect.setAttribute('x', String(-w / 2));
    pRect.setAttribute('width', String(w));
    packet.setAttribute('transform', 'translate(' + x + ',' + y + ')');
    packet.classList.remove('is-hidden');
  }
  function hidePacket() { packet.classList.add('is-hidden'); }

  function showBadge(text, pulse) {
    var w = textWidth(text, 13) + 26;
    bText.textContent = text;
    bRect.setAttribute('x', String(-w / 2));
    bRect.setAttribute('width', String(w));
    badge.classList.remove('is-hidden');
  }
  function hideBadge() { badge.classList.add('is-hidden'); }

  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function moveLeg(from, to, label, token) {
    return new Promise(function (resolve) {
      var p = legPoints(from, to, label);
      setPacket(label, p.x1, p.y1);
      var dist = Math.sqrt(Math.pow(p.x2 - p.x1, 2) + Math.pow(p.y2 - p.y1, 2));
      var dur = Math.max(650, dist * 3.2);
      var t0 = performance.now();
      function tick(now) {
        if (token !== runToken) { resolve(false); return; }
        var t = Math.min(1, (now - t0) / dur);
        var k = easeInOut(t);
        packet.setAttribute('transform', 'translate(' + (p.x1 + (p.x2 - p.x1) * k) + ',' + (p.y1 + (p.y2 - p.y1) * k) + ')');
        if (t < 1) requestAnimationFrame(tick); else resolve(true);
      }
      requestAnimationFrame(tick);
    });
  }

  function placeFinalPacket(m) {
    if (m.back) {
      var r = legPoints(m.to, m.from, m.back);
      setPacket(m.back, r.x2, r.y2);
    } else {
      var f = legPoints(m.from, m.to, m.out);
      setPacket(m.out, f.x2, f.y2);
    }
  }

  /* --- 表示の更新 --- */
  function applyHighlight(step) {
    Object.keys(nodeEl).forEach(function (k) {
      var el = nodeEl[k];
      el.classList.toggle('is-active', step.active.indexOf(k) !== -1);
      el.classList.toggle('is-dim', !sim.used[k]);
      el.classList.toggle('pulse', !!step.pulse && k === 'dns');
    });
    var on = step.move ? sortedKey(step.move.from, step.move.to) : '';
    edgeEls.forEach(function (el) {
      var key = el.getAttribute('data-edge');
      var ends = key.split('-');
      el.classList.toggle('is-dim', !(sim.used[ends[0]] && sim.used[ends[1]]));
      el.classList.toggle('is-on', key === on && !step.web);
      el.classList.toggle('is-on-web', key === on && !!step.web);
    });
  }

  function renderPanel() {
    var s = sim.steps[sim.idx];
    var n = sim.steps.length;
    $('#stepNo').textContent = 'ステップ ' + (sim.idx + 1) + ' / ' + n;
    $('#stepTitle').textContent = s.title;
    $('#stepText').innerHTML = s.text;
    $$('#stepList .st').forEach(function (b, i) {
      if (i === sim.idx) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      b.classList.toggle('is-done', i < sim.idx);
    });
    $('#prevBtn').disabled = sim.idx === 0;
    $('#nextBtn').disabled = sim.idx === n - 1;
  }

  async function showStep(i, animate) {
    var token = ++runToken;
    sim.idx = i;
    var s = sim.steps[i];
    renderPanel();
    applyHighlight(s);
    hidePacket();
    hideBadge();
    if (s.badge) showBadge(s.badge, s.pulse);
    if (!s.move) return;
    var m = s.move;
    if (animate === false || reduceMotion) { placeFinalPacket(m); return; }
    var ok = await moveLeg(m.from, m.to, m.out, token);
    if (!ok || token !== runToken) return;
    if (m.back) {
      await sleep(350);
      if (token !== runToken) return;
      await moveLeg(m.to, m.from, m.back, token);
    }
  }

  function updateNodeTexts() {
    var h = current();
    $('#pcSub').textContent = h.app;
    $('#webTitle').textContent = h.role;
    $('#webSub').textContent = h.fqdn;
    $('#tldTitle').textContent = '.' + h.tld + 'のDNS';
    $('#tldSub').textContent = '.' + h.tld + ' の担当';
    $('#authSub').textContent = h.domain + ' の担当';
  }

  function buildStepList() {
    $('#stepList').innerHTML = sim.steps.map(function (s, i) {
      return '<li><button type="button" class="st" data-i="' + i + '"><span class="st-n">' + (i + 1) + '</span><span>' + esc(s.title) + '</span></button></li>';
    }).join('');
  }

  function stopPlay() {
    playToken++;
    playing = false;
    $('#playBtn').textContent = '自動で進める';
  }

  function rebuildSim() {
    stopPlay();
    var h = current();
    sim.steps = buildSteps(h, sim.mode, sim.cache);
    sim.used = {};
    sim.steps.forEach(function (s) {
      s.active.forEach(function (n) { sim.used[n] = true; });
      if (s.move) { sim.used[s.move.from] = true; sim.used[s.move.to] = true; }
    });
    updateNodeTexts();
    buildStepList();
    showStep(0, false);
  }

  async function play() {
    var my = ++playToken;
    playing = true;
    $('#playBtn').textContent = '止める';
    if (sim.idx >= sim.steps.length - 1) {
      await showStep(0, false);
    }
    while (playToken === my && sim.idx < sim.steps.length - 1) {
      await sleep(1500);
      if (playToken !== my) return;
      await showStep(sim.idx + 1, true);
    }
    if (playToken === my) {
      await sleep(600);
      if (playToken === my) stopPlay();
    }
  }

  function bindSim() {
    $('#nextBtn').addEventListener('click', function () {
      stopPlay();
      if (sim.idx < sim.steps.length - 1) showStep(sim.idx + 1, true);
    });
    $('#prevBtn').addEventListener('click', function () {
      stopPlay();
      if (sim.idx > 0) showStep(sim.idx - 1, false);
    });
    $('#resetBtn').addEventListener('click', function () {
      stopPlay();
      showStep(0, false);
    });
    $('#playBtn').addEventListener('click', function () {
      if (playing) stopPlay(); else play();
    });
    $('#stepList').addEventListener('click', function (e) {
      var b = e.target.closest('.st');
      if (!b) return;
      stopPlay();
      showStep(parseInt(b.getAttribute('data-i'), 10), true);
    });
    $$('.seg button[data-mode]').forEach(function (b) {
      b.addEventListener('click', function () {
        sim.mode = b.getAttribute('data-mode');
        $$('.seg button[data-mode]').forEach(function (x) {
          x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
        });
        rebuildSim();
      });
    });
    $('#cacheToggle').addEventListener('change', function (e) {
      sim.cache = e.target.checked;
      rebuildSim();
    });
  }

  /* ---------------------------------------------------------
     4. ネットワーク図：機器の説明
     --------------------------------------------------------- */
  var NET_INFO = {
    pc: {
      title: 'PC(あなたの端末)',
      text: '名前を使ってサイトを見たいとき、まずここから問い合わせが始まります。PCには「聞く相手のDNSサーバのIPアドレス」が設定されています。'
    },
    phone: {
      title: 'スマホ',
      text: 'スマホもPCと同じです。Wi-Fiでルータにつながり、名前を調べたいときはDNSサーバに問い合わせます。'
    },
    router: {
      title: 'ルータ(LANの出入口)',
      text: '家や学校のネットワーク(LAN)と、外のネットワークをつなぐ機器です。家庭用ルータは、機器からの名前の問い合わせを受けとって、プロバイダのDNSサーバに取り次ぐ(中継する)ことが多いです。'
    },
    isp: {
      title: 'ISPの設備',
      text: 'プロバイダ(ISP)の回線や機器です。ここを通って、家や学校のネットワークがインターネットにつながります。'
    },
    cache: {
      title: 'キャッシュDNSサーバ(いつも聞く相手)',
      text: 'PCが最初に問い合わせる相手です。答えを知らなければ、インターネット上のDNSサーバに順番に聞いて調べ、その答えをしばらく覚えておきます(キャッシュ)。プロバイダのほか、学校の中や、だれでも使える公開DNSサービス(例:8.8.8.8 や 1.1.1.1)にもあります。'
    },
    root: {
      title: 'ルートDNSサーバ',
      text: '名前の階層のいちばん上です。「.jp」「.com」など、末尾の部分を担当するDNSサーバの場所を知っています。世界中に多くの機器が分散して置かれています。'
    },
    tld: {
      title: 'TLDのDNSサーバ',
      text: '「.jp」「.com」のように、末尾の部分(トップレベルドメイン)ごとに担当が決まっています。「example.jp」を管理している権威DNSサーバの場所を教えてくれます。'
    },
    auth: {
      title: '権威DNSサーバ',
      text: 'あるドメイン(例:example.jp)の「ホスト名とIPアドレスの対応表」を、実際にもっているサーバです。ドメインを管理する会社や組織が用意します。ここの答えが正式な答えです。'
    },
    web: {
      title: 'Webサーバ',
      text: '最終的にアクセスしたい相手です。IPアドレスをもっていて、アクセスされるとページのデータを返します。DNSサーバとは別の役割のサーバです。'
    }
  };

  function selectNet(key) {
    var info = NET_INFO[key];
    if (!info) return;
    $$('.net-node').forEach(function (g) {
      g.classList.toggle('is-selected', g.getAttribute('data-node') === key);
    });
    $('#netInfoTitle').textContent = info.title;
    $('#netInfoText').textContent = info.text;
  }

  function bindNet() {
    $$('.net-node').forEach(function (g) {
      g.addEventListener('click', function () { selectNet(g.getAttribute('data-node')); });
      g.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectNet(g.getAttribute('data-node'));
        }
      });
    });
    var btn = $('#dnsFocusBtn');
    btn.addEventListener('click', function () {
      var on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.textContent = on ? 'もとにもどす' : 'DNSサーバをさがす';
      $('#net').classList.toggle('focus-dns', on);
      if (on) selectNet('cache');
    });
  }

  /* ---------------------------------------------------------
     コマンドのコピー
     --------------------------------------------------------- */
  function bindCopy() {
    $$('[data-copy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var old = btn.textContent;
        var done = function (msg) {
          btn.textContent = msg;
          setTimeout(function () { btn.textContent = old; }, 1500);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(btn.getAttribute('data-copy')).then(
            function () { done('コピーした'); },
            function () { done('コピーできません'); }
          );
        } else {
          done('コピーできません');
        }
      });
    });
  }

  /* ---------------------------------------------------------
     5. クイズ
     --------------------------------------------------------- */
  var QUIZ = [
    {
      q: 'IPアドレスの形として正しいものは、どれ?',
      options: [
        { t: '203.0.113.10', ok: true },
        { t: 'www.example.jp' },
        { t: '300.256.1.999' },
        { t: 'example@jp' }
      ],
      why: 'IPアドレスは、0〜255の数字を4つ「.」でつないだ形です。「www.example.jp」はドメイン名、「300.256.1.999」は255をこえる数字があるので正しくありません。'
    },
    {
      q: '「mail.example.jp」のうち、ホスト名にあたる部分はどれ?',
      options: [
        { t: 'mail', ok: true },
        { t: 'example' },
        { t: 'jp' },
        { t: 'example.jp' }
      ],
      why: '左端がホスト名(1台のコンピュータの名前)です。その右側の「example.jp」がドメイン名で、あわせて「mail.example.jp」というFQDNになります。'
    },
    {
      q: 'DNSサーバのおもな働きは、どれ?',
      options: [
        { t: 'ドメイン名に対応するIPアドレスを調べて教える', ok: true },
        { t: 'Webページのデータを保存して表示する' },
        { t: 'ウイルスを見つけて削除する' },
        { t: 'Wi-Fiの電波を強くする' }
      ],
      why: 'DNSサーバは「名前 → IPアドレス」の案内係です。Webページのデータを持っているのはWebサーバです。'
    },
    {
      q: 'PCが名前を調べたいとき、最初に問い合わせる相手はどれ?',
      options: [
        { t: 'キャッシュDNSサーバ(学校・家・プロバイダなどにある)', ok: true },
        { t: 'ルートDNSサーバ' },
        { t: 'Webサーバ' },
        { t: '権威DNSサーバ' }
      ],
      why: 'PCには、聞く相手のDNSサーバのIPアドレスが設定されています。まずそこに聞き、答えを知らなければ、そのDNSサーバがルート → TLD → 権威DNSサーバと順にたずねてくれます。'
    },
    {
      q: 'DNSサーバが、いちど調べた答えをしばらく覚えておくしくみを、何という?',
      options: [
        { t: 'キャッシュ', ok: true },
        { t: 'ルーティング' },
        { t: 'ダウンロード' },
        { t: 'ログイン' }
      ],
      why: 'キャッシュのおかげで、同じ名前をもういちど聞かれたときに、ほかのDNSサーバに聞かずにすぐ答えられます。'
    },
    {
      q: 'DNSサーバの説明として、正しいものはどれ?',
      options: [
        { t: 'ネットワークにつながったコンピュータで、家や学校、プロバイダ、インターネット上など、いろいろな場所にある', ok: true },
        { t: 'インターネット全体で、世界にたった1台だけある' },
        { t: '自分のPCの中にだけ入っている' },
        { t: 'Webサーバと同じ機械でなければならない' }
      ],
      why: 'DNSサーバもIPアドレスをもつコンピュータです。役割を分けて、たくさんの場所に置かれています。'
    }
  ];

  var KANA = ['ア', 'イ', 'ウ', 'エ'];
  var quizState = { answered: 0, correct: 0 };

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function buildQuiz() {
    quizState = { answered: 0, correct: 0 };
    $('#quizResult').innerHTML = '';
    var box = $('#quiz');
    box.innerHTML = QUIZ.map(function (item, qi) {
      var opts = shuffle(item.options);
      return '<div class="q" role="group" aria-labelledby="q' + qi + '" data-q="' + qi + '">' +
        '<p class="q-text" id="q' + qi + '"><span class="q-no">Q' + (qi + 1) + '</span>' + esc(item.q) + '</p>' +
        '<ul class="opts">' + opts.map(function (o, oi) {
          return '<li><button type="button" class="opt" data-ok="' + (o.ok ? '1' : '0') + '">' +
            '<span class="mk" aria-hidden="true">' + KANA[oi] + '</span><span>' + esc(o.t) + '</span></button></li>';
        }).join('') + '</ul>' +
        '<div class="q-exp" hidden></div>' +
      '</div>';
    }).join('');
  }

  function bindQuiz() {
    $('#quiz').addEventListener('click', function (e) {
      var b = e.target.closest('.opt');
      if (!b || b.disabled) return;
      var q = b.closest('.q');
      var item = QUIZ[parseInt(q.getAttribute('data-q'), 10)];
      var isOk = b.getAttribute('data-ok') === '1';

      $$('.opt', q).forEach(function (o) {
        o.disabled = true;
        if (o.getAttribute('data-ok') === '1') {
          o.classList.add('is-right');
          $('.mk', o).textContent = '○';
        }
      });
      if (!isOk) {
        b.classList.add('is-wrong');
        $('.mk', b).textContent = '×';
      }
      var exp = $('.q-exp', q);
      exp.hidden = false;
      exp.innerHTML = '<strong>' + (isOk ? '正解!' : 'ざんねん。') + '</strong> ' + esc(item.why);

      quizState.answered++;
      if (isOk) quizState.correct++;
      if (quizState.answered === QUIZ.length) showQuizResult();
    });

    $('#quizResult').addEventListener('click', function (e) {
      if (e.target.closest('[data-retry]')) {
        buildQuiz();
        $('#quiz').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      }
    });
  }

  function showQuizResult() {
    var c = quizState.correct, n = QUIZ.length;
    var msg = c === n ? '全問正解! DNSのしくみはバッチリです。'
            : c >= n - 2 ? 'いい調子です。まちがえたところを、図やシミュレーターで見直してみよう。'
            : '図とシミュレーターにもどって、もういちど流れをたしかめてみよう。';
    $('#quizResult').innerHTML =
      '<div class="score">' + c + ' / ' + n + '</div><p>' + msg + '</p>' +
      '<button type="button" class="btn" data-retry>もういちどやる</button>';
  }

  /* ---------------------------------------------------------
     目次：いま読んでいる駅をハイライト
     --------------------------------------------------------- */
  function bindToc() {
    var links = $$('.toc a');
    var toc = $('.toc');
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) {
          var on = a.getAttribute('data-sec') === en.target.id;
          if (on) {
            a.setAttribute('aria-current', 'true');
            toc.scrollLeft = a.offsetLeft - toc.clientWidth / 2 + a.clientWidth / 2;
          } else {
            a.removeAttribute('aria-current');
          }
        });
      });
    }, { rootMargin: '-35% 0px -60% 0px' });
    ['s1', 's2', 's3', 's4', 's5'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) io.observe(el);
    });
  }

  /* ---------------------------------------------------------
     はじめ
     --------------------------------------------------------- */
  function init() {
    buildChips();
    buildMapping();
    bindSim();
    bindNet();
    bindCopy();
    bindToc();
    buildQuiz();
    bindQuiz();

    onSelect(function () {
      syncChips();
      syncMapping();
      renderBoard(true);
      renderAnatomy();
      rebuildSim();
    });

    syncChips();
    syncMapping();
    renderAnatomy();
    rebuildSim();
    renderBoard(true);   // ページを開いたとき、案内板の数字が1回だけパタパタ変わる
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
