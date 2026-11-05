(() => {
  'use strict';

  /* ------------------------------------------------------------------
     Config: edit these to add or swap games and studios.
     Live data is fetched through RoProxy (roblox.com APIs block
     browser requests from other sites). The numbers in index.html are
     a snapshot that stays visible if the proxy can't be reached.
     ------------------------------------------------------------------ */
  const USER_ID = 53919328;
  const GAMES = {
    motorush: { universeId: 4867536568 },
    drift: { universeId: 10770249358 },
  };
  const GROUPS = {
    motorush: 32734353,
    titan: 34291085,
  };
  const PROXY = 'roproxy.com';
  const REFRESH_MS = 60_000;

  // Snapshot from 5 Nov 2026, used until live data arrives.
  const state = {
    games: {
      motorush: { visits: 101134348, playing: 99, favorites: 236433, up: 119785, down: 13037 },
      drift: { visits: 12928, playing: 24, favorites: 76, up: 14, down: 9 },
    },
    groups: { motorush: 135468, titan: 32 },
  };

  // A static build (e.g. the shareable copy, where outside requests are
  // blocked) sets window.WAGED_STATIC = { date, state } before this script.
  const STATIC = window.WAGED_STATIC || null;
  if (STATIC?.state) {
    for (const [k, g] of Object.entries(STATIC.state.games ?? {})) Object.assign(state.games[k] ?? {}, g);
    Object.assign(state.groups, STATIC.state.groups ?? {});
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = new Intl.NumberFormat('en-US');
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const byUniverse = Object.fromEntries(Object.entries(GAMES).map(([k, g]) => [g.universeId, k]));
  const universeIds = Object.values(GAMES).map((g) => g.universeId).join(',');

  /* ---------------- Tabs ---------------- */

  const TABS = ['about', 'games', 'highlights', 'socials', 'stats'];
  const TITLES = {
    about: 'Waged',
    games: 'Games · Waged',
    highlights: 'Highlights · Waged',
    socials: 'Socials · Waged',
    stats: 'Stats · Waged',
  };
  const panels = Object.fromEntries(TABS.map((id) => [id, document.getElementById(id)]));
  const tabLinks = $$('.tabs a[data-tab]');
  const pill = document.querySelector('.tabs__pill');
  let activeTab = null;

  const tabFromHash = () => {
    const h = decodeURIComponent(location.hash.slice(1));
    return TABS.includes(h) ? h : 'about';
  };

  function movePill() {
    const link = tabLinks.find((a) => a.dataset.tab === activeTab);
    if (!pill || !link) return;
    pill.style.width = `${link.offsetWidth}px`;
    pill.style.transform = `translateX(${link.offsetLeft}px)`;
    // On the narrowest phones the tab bar scrolls: keep the active tab in view.
    const nav = link.parentElement;
    if (nav.scrollWidth > nav.clientWidth) {
      nav.scrollTo({ left: link.offsetLeft - (nav.clientWidth - link.offsetWidth) / 2, behavior: 'smooth' });
    }
  }

  // Rise the panel's pieces in one after another.
  function enter(panel) {
    const items = [...panel.children].flatMap((c) => (c.matches('.scards, .stats') ? [...c.children] : [c]));
    items.forEach((el, i) => {
      el.classList.remove('st');
      el.style.setProperty('--d', String(Math.min(i, 8)));
    });
    void panel.offsetWidth; // restart the animation
    items.forEach((el) => el.classList.add('st'));
    clearTimeout(panel.stTimer);
    // Hand back to the scroll animations once the entrance is done.
    panel.stTimer = setTimeout(() => items.forEach((el) => el.classList.remove('st')), 1400);
  }

  function showTab(id, initial = false) {
    if (id === activeTab) return;
    activeTab = id;
    document.documentElement.dataset.tab = id;
    if (!initial) document.documentElement.classList.remove('intro');

    for (const t of TABS) {
      const panel = panels[t];
      const on = t === id;
      panel.hidden = !on;
      if (on && !initial && !reduceMotion) enter(panel);
    }

    for (const a of tabLinks) {
      if (a.dataset.tab === id) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }

    movePill();
    document.title = TITLES[id];
    if (!initial) window.scrollTo({ top: 0, behavior: 'instant' });
    if (id === 'stats') countUp();
  }

  window.addEventListener('hashchange', () => showTab(tabFromHash()));
  window.addEventListener('resize', movePill);
  document.fonts?.ready.then(movePill);

  /* ---------------- Top bar border on scroll ---------------- */

  const topbar = document.querySelector('.topbar');
  const onScroll = () => topbar.classList.toggle('is-scrolled', window.scrollY > 4);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------------- Number formatting ---------------- */

  // 101,134,348 -> "101M+", 12,928 -> "12.9K+", 76 -> "76". Always rounds down.
  function compact(n) {
    const units = [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
    for (const [size, suffix] of units) {
      if (n >= size) {
        const x = n / size;
        const digits = x < 100 ? 1 : 0;
        const floored = Math.floor(x * 10 ** digits) / 10 ** digits;
        return `${floored.toFixed(digits).replace(/\.0$/, '')}${suffix}+`;
      }
    }
    return fmt.format(Math.floor(n));
  }

  const values = {};

  function setStat(key, text, raw, animate) {
    if (raw !== undefined) values[key] = raw;
    for (const el of $$(`[data-stat="${key}"]`)) {
      if (el.textContent === text) continue;
      el.textContent = text;
      if (animate && !reduceMotion) {
        el.classList.remove('bump');
        void el.offsetWidth;
        el.classList.add('bump');
      }
    }
  }

  function render(animate = false) {
    let visits = 0, playing = 0, favorites = 0;

    for (const [key, g] of Object.entries(state.games)) {
      visits += g.visits;
      playing += g.playing;
      favorites += g.favorites;

      setStat(`${key}.visits`, compact(g.visits), g.visits, animate);
      setStat(`${key}.visitsFull`, `${fmt.format(g.visits)} total`, undefined, false);
      setStat(`${key}.playing`, fmt.format(g.playing), g.playing, animate);
      setStat(`${key}.favorites`, compact(g.favorites), g.favorites, animate);

      const votes = g.up + g.down;
      const rating = votes ? Math.round((g.up / votes) * 100) : null;
      setStat(`${key}.rating`, rating === null ? '–' : `${rating}%`, rating, animate);
      for (const el of $$(`[data-meter="${key}"]`)) el.style.width = `${rating ?? 0}%`;
    }

    setStat('total.visits', compact(visits), visits, animate);
    setStat('total.visitsFull', `${fmt.format(visits)} total`, undefined, false);
    setStat('total.playing', fmt.format(playing), playing, animate);
    setStat('total.favorites', compact(favorites), favorites, animate);

    for (const [key, n] of Object.entries(state.groups)) {
      setStat(`group.${key}`, fmt.format(n), n, animate);
    }
  }

  // Count the big visit numbers up the first time the Stats tab opens.
  let counted = false;
  function countUp() {
    if (counted || reduceMotion) return;
    counted = true;
    // Fill the rating bars from empty.
    for (const bar of $$('[data-meter]')) {
      const width = bar.style.width;
      bar.style.transition = 'none';
      bar.style.width = '0%';
      void bar.offsetWidth;
      bar.style.transition = '';
      requestAnimationFrame(() => { bar.style.width = width; });
    }
    const els = $$('[data-count]');
    const start = performance.now();
    const duration = 1100;
    const ease = (t) => 1 - Math.pow(1 - t, 4);
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      for (const el of els) {
        const target = values[el.dataset.stat] ?? 0;
        el.textContent = compact(Math.max(1, target * ease(t)));
      }
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------------- Live data ---------------- */

  async function getJSON(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  const stampEl = document.getElementById('stamp');
  let lastLive = null;

  function updateStamp() {
    if (!stampEl) return;
    if (lastLive) {
      const time = lastLive.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      stampEl.textContent = `Updated ${time}. Live from Roblox, refreshes every minute.`;
    } else {
      stampEl.textContent = "Couldn't reach Roblox just now, so these are numbers saved on 5 Nov 2026.";
    }
  }

  async function refreshStats() {
    const [info, votes, groups] = await Promise.allSettled([
      getJSON(`https://games.${PROXY}/v1/games?universeIds=${universeIds}`),
      // The batched votes endpoint is blocked on RoProxy, so ask per game.
      Promise.all(Object.values(GAMES).map((g) => getJSON(`https://games.${PROXY}/v1/games/${g.universeId}/votes`)))
        .then((data) => ({ data })),
      Promise.all(Object.entries(GROUPS).map(async ([key, id]) => {
        const g = await getJSON(`https://groups.${PROXY}/v1/groups/${id}`);
        return [key, g.memberCount];
      })),
    ]);

    let gotLive = false;
    if (info.status === 'fulfilled') {
      for (const g of info.value.data ?? []) {
        const key = byUniverse[g.id];
        if (!key) continue;
        Object.assign(state.games[key], {
          visits: g.visits ?? state.games[key].visits,
          playing: g.playing ?? state.games[key].playing,
          favorites: g.favoritedCount ?? state.games[key].favorites,
        });
        gotLive = true;
      }
    }
    if (votes.status === 'fulfilled') {
      for (const v of votes.value.data ?? []) {
        const key = byUniverse[v.id];
        if (key) Object.assign(state.games[key], { up: v.upVotes, down: v.downVotes });
      }
    }
    if (groups.status === 'fulfilled') {
      for (const [key, n] of groups.value) if (typeof n === 'number') state.groups[key] = n;
    }

    if (gotLive) lastLive = new Date();
    render(true);
    updateStamp();
  }

  // Swap an <img> to a new URL only once the new image has loaded.
  function swapImage(img, url) {
    if (!url || img.getAttribute('src') === url) return;
    const probe = new Image();
    probe.onload = () => {
      img.src = url;
      img.classList.remove('is-broken');
      img.closest('.is-missing')?.classList.remove('is-missing');
    };
    probe.src = url;
  }
  const swapAll = (selector, url) => $$(selector).forEach((img) => swapImage(img, url));

  async function refreshImages() {
    const groupIds = Object.values(GROUPS).join(',');
    await Promise.allSettled([
      getJSON(`https://thumbnails.${PROXY}/v1/users/avatar?userIds=${USER_ID}&size=720x720&format=Png&isCircular=false`)
        .then((j) => {
          const t = j.data?.[0];
          if (t?.state === 'Completed') swapAll('[data-img="avatar"]', t.imageUrl);
        }),

      getJSON(`https://thumbnails.${PROXY}/v1/games/icons?universeIds=${universeIds}&size=512x512&format=Png&isCircular=false`)
        .then((j) => {
          for (const t of j.data ?? []) {
            const key = byUniverse[t.targetId];
            if (key && t.state === 'Completed') swapAll(`[data-img="${key}.icon"]`, t.imageUrl);
          }
        }),

      getJSON(`https://thumbnails.${PROXY}/v1/games/multiget/thumbnails?universeIds=${universeIds}&countPerUniverse=3&defaults=true&size=768x432&format=Png&isCircular=false`)
        .then((j) => {
          for (const u of j.data ?? []) {
            const key = byUniverse[u.universeId];
            const urls = (u.thumbnails ?? []).filter((t) => t.state === 'Completed').map((t) => t.imageUrl);
            if (key && urls.length) carousels[key]?.setImages(urls);
          }
        }),

      getJSON(`https://thumbnails.${PROXY}/v1/groups/icons?groupIds=${groupIds}&size=150x150&format=Png&isCircular=false`)
        .then((j) => {
          for (const t of j.data ?? []) {
            const key = Object.keys(GROUPS).find((k) => GROUPS[k] === t.targetId);
            if (key && t.state === 'Completed') swapAll(`[data-img="group.${key}"]`, t.imageUrl);
          }
        }),
    ]);
  }

  /* ---------------- Screenshot carousels ---------------- */

  function makeCarousel(root) {
    const track = root.querySelector('.slides');
    const dots = root.querySelector('.dots');
    const name = root.closest('.showcase')?.querySelector('.showcase__name')?.firstChild?.textContent.trim() ?? 'Game';
    let slides = [];
    let index = 0;
    let timer = null;

    function go(i) {
      index = (i + slides.length) % slides.length;
      slides.forEach((img, j) => img.classList.toggle('is-active', j === index));
      [...dots.children].forEach((b, j) => {
        b.classList.toggle('is-active', j === index);
        b.setAttribute('aria-pressed', String(j === index));
      });
    }

    function restart() {
      clearInterval(timer);
      if (slides.length < 2 || reduceMotion) return;
      timer = setInterval(() => {
        if (!root.closest('.panel')?.hidden && !document.hidden) go(index + 1);
      }, 4500);
    }

    function build() {
      slides = [...track.querySelectorAll('img')];
      dots.replaceChildren(...slides.map((_, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('aria-label', `Show screenshot ${i + 1}`);
        b.addEventListener('click', () => { go(i); restart(); });
        return b;
      }));
      dots.hidden = slides.length < 2;
      go(0);
      restart();
    }

    build();

    return {
      setImages(urls) {
        const current = slides.map((img) => img.getAttribute('src'));
        if (urls.join() === current.join()) return;
        track.replaceChildren(...urls.map((url, i) => {
          const img = new Image(768, 432);
          img.decoding = 'async';
          img.alt = `${name} screenshot ${i + 1}`;
          img.src = url;
          return img;
        }));
        build();
      },
    };
  }

  const carousels = {};
  for (const el of $$('[data-carousel]')) {
    const key = el.closest('[data-game]')?.dataset.game;
    if (key) carousels[key] = makeCarousel(el);
  }

  /* ---------------- Copy Discord username ---------------- */

  const toastEl = document.getElementById('toast');
  let toastTimer;
  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 2400);
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.append(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      ta.remove();
      return ok;
    }
  }

  for (const btn of $$('[data-copy]')) {
    btn.addEventListener('click', async () => {
      const text = btn.dataset.copy;
      const ok = await copy(text);
      toast(ok ? `Copied “${text}”. Add me on Discord!` : `My Discord is “${text}”`);
    });
  }

  /* ---------------- Pointer effects ---------------- */

  const finePointer = window.matchMedia('(pointer: fine)').matches;

  if (finePointer && !reduceMotion) {
    // Avatar parallax: follow the mouse across the hero.
    const hero = document.querySelector('.hero');
    const art = document.querySelector('.hero__art');
    let frame = 0;
    hero?.addEventListener('pointermove', (e) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = hero.getBoundingClientRect();
        const px = ((e.clientX - r.left) / r.width) * 2 - 1;
        const py = ((e.clientY - r.top) / r.height) * 2 - 1;
        art.style.setProperty('--px', px.toFixed(3));
        art.style.setProperty('--py', py.toFixed(3));
      });
    });
    hero?.addEventListener('pointerleave', () => {
      cancelAnimationFrame(frame);
      art.style.setProperty('--px', '0');
      art.style.setProperty('--py', '0');
    });

    // Spotlight that follows the cursor on cards.
    document.addEventListener('pointermove', (e) => {
      const card = e.target.closest?.('.link, .game, .studio, .scard, .card, .event');
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    }, { passive: true });
  }

  /* ---------------- Go ---------------- */

  render();

  // The home page intro plays once; afterwards hover effects take over.
  setTimeout(() => document.documentElement.classList.remove('intro'), 2200);

  // Place the pill without animating on first paint, then enable transitions.
  pill?.classList.add('no-anim');
  showTab(tabFromHash(), true);
  requestAnimationFrame(() => requestAnimationFrame(() => pill?.classList.remove('no-anim')));

  // Stop the browser jumping to the hidden section's anchor on load.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  if (STATIC) {
    if (stampEl) stampEl.textContent = `Numbers from ${STATIC.date}. Data from Roblox.`;
    return;
  }

  refreshStats();
  refreshImages();

  let refreshTimer = setInterval(refreshStats, REFRESH_MS);
  document.addEventListener('visibilitychange', () => {
    clearInterval(refreshTimer);
    if (document.hidden) return;
    if (!lastLive || Date.now() - lastLive.getTime() > REFRESH_MS) refreshStats();
    refreshTimer = setInterval(refreshStats, REFRESH_MS);
  });
})();
