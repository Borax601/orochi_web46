if (typeof window.measureAndApply !== 'function') {
  window.measureAndApply = function () { };
}

// ページの全てのコンテンツが読み込まれてから実行する
document.addEventListener('DOMContentLoaded', function() {
  setupHeroAnimation();
  initializeApp();
});

// ===== ヒーローアニメーション =====
function setupHeroAnimation() {
  const frames = [
    document.getElementById('orochi-pose-a'),
    document.getElementById('orochi-pose-b'),
    document.getElementById('orochi-pose-c'),
    document.getElementById('orochi-pose-d')
  ];
  const finale = document.getElementById('orochi-pose-e');

  let idx = 0;
  const frameMs       = 1000;  // A〜Dはそのまま
  const finaleHoldMs  = 300;   // ← 0.3秒に短縮
  const finaleFadeMs  = 800;   // フェード時間は0.8秒に変更
  const loopDelay = 1200;

  const hideAll = () => {
    frames.forEach(f => { if (f) f.style.opacity = 0; });
    if (finale) finale.style.opacity = 0;
  };

  const playLoop = () => {
    hideAll();
    idx = 0;

    const frameTimer = setInterval(() => {
      hideAll();
      if (!frames[idx]) return;
      frames[idx].style.opacity = 1;
      frames[idx].style.zIndex = 2;
      idx++;

      if (idx === frames.length) {
        clearInterval(frameTimer);
        setTimeout(() => {
          hideAll();
          if (!finale) return;

          // 1) まずEを静止表示
          finale.style.opacity = 1;
          finale.style.zIndex = 2;          // ← 追加（山の手前に固定）
          finale.classList.remove('is-fading');

          // 2) 指定時間ホールド後にフェード開始
          setTimeout(() => {
            finale.classList.add('is-fading');
            // 3) フェードが終わったら次ループ
            setTimeout(() => {
              finale.classList.remove('is-fading');
              playLoop();
            }, finaleFadeMs);
          }, finaleHoldMs);

        }, frameMs);
      }
    }, frameMs);
  };

  playLoop();
}

// ===== Hero Intro Timeline =====
/* ===== hero timeline (overwrite) ===== */
function playHeroIntro(){
  const steps = [...document.querySelectorAll('#hero-intro .intro-step')];
  if(!steps.length) return;
  const delays = [0, 4000, 7000, 10000];
  const holdLast = 3000;
  let idx = 0;

  const next = () => {
    const cur = steps[idx];
    const prev = steps[idx-1];

    if(cur){
      cur.classList.remove('fade-out');
      cur.classList.add('fade-in');
    }
    if(prev){
      prev.classList.remove('fade-in');
      prev.classList.add('fade-out');
    }

    idx++;
    if(idx < steps.length){
      setTimeout(next, delays[idx] - delays[idx-1]);
    }else{
      setTimeout(()=>{
        steps.forEach(s=>s.classList.remove('fade-in','fade-out'));
        idx = 0;
        next();
      }, holdLast);
    }
  };
  next();
}

document.addEventListener('DOMContentLoaded', () => {
  initializeApp();     // 既存初期化
  playHeroIntro();     // ← 最後に呼ぶ
});

// ===== データ取得 共通 =====
const jsonPath = 'オロチポートフォリオ文字データ/works.json';
const csvPath  = 'オロチポートフォリオ文字データ/オロチポートフォリオ表.csv';
const bust     = `?v=${Date.now()}`;

async function fetchJSON(path) {
  const res = await fetch(path + bust, { cache: 'no-store' });
  if (!res.ok) throw new Error(`JSON fetch failed: ${res.status} ${path}`);
  return await res.json();
}
async function fetchText(path) {
  const res = await fetch(path + bust, { cache: 'no-store' });
  if (!res.ok) throw new Error(`CSV fetch failed: ${res.status} ${path}`);
  return await res.text();
}

// CSV 1行をダブルクォート対応で分解（"で囲まれた, をフィールド内として扱う）
function parseCSVLine(line) {
  if (!line) return [''];
  // 先頭BOM除去 & CR除去
  line = line.replace(/^\uFEFF/, '').replace(/\r$/, '');
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // 連続する "" はエスケープされた " として扱う
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function parseCSVToWorks(text) {
  text = text.replace(/\r/g, '');
  const lines = text.split('\n');
  if (!lines.length) return [];
  const header = parseCSVLine(lines[0]);
  lines.shift(); // ヘッダー除去

  const out = [];
  const COLS = header.length;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    let cells = parseCSVLine(line);

    // 不足 → 右パディング（既存の実装があればそれを残してOK）
    if (cells.length < COLS) {
      cells = cells.concat(Array(COLS - cells.length).fill(''));
    }

    // 過多 → 末尾フィールドにまとめて結合
    if (cells.length > COLS) {
      const mergedTail = cells.slice(COLS - 1).join(',');
      cells = [...cells.slice(0, COLS - 1), mergedTail];
    }

    if (cells.length !== COLS) {
      console.warn(`[CSV] 列不整合 L${i + 2}: expected ${COLS}, got ${cells.length} (auto-fix未完)`);
    }

    const rawDate = (cells[0]||'').trim();
    const digits  = rawDate.replace(/\D/g,'');
    if (!/^\d{8}$/.test(digits)) { continue; }

    const title       = (cells[1]||'').trim();
    const category    = (cells[2]||'').trim();
    const description = (cells[3]||'').trim();

    out.push({
      id: i + 1,
      date: digits,
      month: parseInt(digits.substring(4,6),10),
      title, category, description,
      image_filename: `img_${digits}.png`,
    });
  }
  return out;
}

const lastDate = arr =>
  (arr && arr.length ? arr.map(w => w.date).filter(Boolean).sort().at(-1) : '');

function mergeWorks(jsonArr = [], csvArr = []) {
  const map = new Map();
  for (const w of jsonArr || []) {
    if (!w || !w.date) continue;
    map.set(String(w.date), { ...w, category: (w.category || '').trim() });
  }
  for (const w of csvArr || []) {
    if (!w || !w.date) continue;
    map.set(String(w.date), { ...w, category: (w.category || '').trim() });
  }
  return Array.from(map.values()).sort((a, b) => Number(b.date) - Number(a.date));
}

// ===== アプリ初期化 =====
let digestWorks = []; // TOPページ「奉納作品」用の全データ

async function initializeApp() {
  let jsonData = [];
  let csvData  = [];

  try { jsonData = await fetchJSON(jsonPath); }
  catch (e) { console.warn('JSON 読み込み失敗:', e); }

  try {
    const csvText = await fetchText(csvPath);
    csvData = parseCSVToWorks(csvText);
  } catch (e) {
    console.warn('CSV 読み込み失敗:', e);
  }

  const worksData = mergeWorks(jsonData, csvData);
  console.info('Using MERGED dataset', {
    jsonCount: jsonData.length,
    csvCount: csvData.length,
    merged: worksData.length,
  });
  console.info('months:', [...new Set(worksData.map(w => w.month))].sort((a,b)=>a-b));

  const pageId = document.body.id;
  let worksToDisplay = [];

  if (pageId === 'page-gallery') {
    worksToDisplay = worksData.filter(w => w.category === 'イラスト');
  } else if (pageId === 'page-ai-gallery') {
    worksToDisplay = worksData.filter(w => w.category === 'AI');
  } else if (pageId === 'page-video-gallery') {
    worksToDisplay = worksData.filter(w => w.category === '動画');
  } else if (document.getElementById('digest-gallery-grid')) {
    digestWorks = worksToDisplay = worksData
      .filter(w => w.category === 'イラスト' && w.date)
      .sort((a, b) => Number(b.date) - Number(a.date));
    refreshDigestGrid(); // 下で定義する関数
  }

  if (document.getElementById('full-gallery-grid')) {
    renderGallery(worksToDisplay, '#full-gallery-grid');
    setupFilter(worksToDisplay);
  }
  if (document.getElementById('digest-gallery-grid')) {
    // renderGallery(worksToDisplay.slice(0, 10), '#digest-gallery-grid');
  }

  renderAIDigest(worksData);
  renderVideoDigest(worksData); // 追加

  setupLikeButtons();
  setupHamburgerMenu();
  markCurrentNav();
  // setupHeaderAutoHide();   ← これをコメントアウト

  /* === Header fade-out on scroll (2025-08-07) ================= */
  (function setupHeaderFade(){
    const header = document.querySelector('.global-header');
    if(!header) return;

    const fadeEnd = window.innerHeight * 0.2;  // 20% で完全透明
    header.style.willChange = 'opacity';

    let ticking = false;
    window.addEventListener('scroll', () => {
      if(ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const opacity = Math.max(0, 1 - y / fadeEnd);
        header.style.opacity = opacity.toFixed(3);
        ticking = false;
      });
    }, { passive: true });
  })();
  window.addEventListener('resize', onResizeDigest); // 画面リサイズごとに TOP digest を再描画

  /* === Hero fade-out on scroll (robust: no ID required) ================= */
  (function heroFadeRobust(){
    // ヒーロー候補を幅広く探索（id, class, data-hero）
    const hero = document.querySelector('#hero, section.hero, .hero-section, [data-hero], .hero');
    // コンテンツ開始は #main-content が最優先、無ければ <main>
    const main = document.querySelector('#main-content') || document.querySelector('main');

    if(!hero || !main) return; // 無関係ページでは自動無効化

    // main に触れる直前で0にしたい場合は 20〜40 に
    const FINISH_OFFSET = 0;

    let raf = null;

    function computeAndApply(){
      // ページ基準位置を毎回取得（レイアウト変動に強い）
      const heroRect = hero.getBoundingClientRect();
      const heroTop  = heroRect.top + window.scrollY;      // フェード開始
      const mainTop  = main.getBoundingClientRect().top + window.scrollY;
      const endY     = Math.max(heroTop + 1, mainTop - FINISH_OFFSET); // フェード終了位置
      const total    = Math.max(1, endY - heroTop);

      const y = window.scrollY;
      const t = Math.min(Math.max((y - heroTop) / total, 0), 1); // 0→1
      const op = 1 - t;

      hero.style.opacity = op.toFixed(3);
      // 透明時はクリックを透過（他要素は無変更）
      hero.style.pointerEvents = (op < 0.05) ? 'none' : '';
      raf = null;
    }

    function onScroll(){ if(!raf) raf = requestAnimationFrame(computeAndApply); }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', computeAndApply);
    window.addEventListener('orientationchange', computeAndApply);

    // 初期反映
    computeAndApply();
  })();

}

function refreshDigestGrid() {
  const gridEl = document.getElementById('digest-gallery-grid');
  if (!gridEl || !digestWorks.length) return;

  const maxShow = calcColumns() * 2; // 列数 ×2 行
  renderGallery(digestWorks.slice(0, maxShow), '#digest-gallery-grid');
  setupLikeButtons(); // like 再バインド
}

function onResizeDigest() {
  const newCols = calcColumns();
  if (newCols !== onResizeDigest._prevCols) {
    onResizeDigest._prevCols = newCols;
    refreshDigestGrid();
  }
}
onResizeDigest._prevCols = calcColumns(); // 初期化

// === AI digest responsive (1 row: 4/3/2/1) ===
let aiAllWorks = [];
let _aiPrevCols = 0;

function getAIDigestCols() {
  const w = window.innerWidth;
  // 要件: 横1179pxまでは4枚表示を維持
  if (w >= 1179) return 4;
  if (w >= 891) return 3;   // 小型ノート
  if (w >= 603)  return 2;   // タブレット
  return 1;                  // スマホ
}

function refreshAIDigest() {
  const grid = document.getElementById('ai-digest-grid');
  if (!grid || !aiAllWorks.length) return;
  const cols = getAIDigestCols();
  if (cols === _aiPrevCols && grid.children.length) return; // 無駄な再描画防止
  _aiPrevCols = cols;

  // 1 行だけ描画するため、表示数 = 列数 に限定
  renderGallery(aiAllWorks.slice(0, cols), '#ai-digest-grid');

  // いいね再バインド（既存仕様踏襲）
  if (typeof setupLikeButtons === 'function') setupLikeButtons();
}

function onResizeAIDigest() {
  const cols = getAIDigestCols();
  if (cols !== _aiPrevCols) refreshAIDigest();
}

function renderAIDigest(works) {
  const grid = document.getElementById('ai-digest-grid');
  if (!grid) return;

  aiAllWorks = (works || [])
    .filter(w => w.category === 'AI')
    .sort((a, b) => Number(b.date) - Number(a.date)); // 新しい順

  refreshAIDigest();
  window.addEventListener('resize', onResizeAIDigest);
}

// === Video digest responsive (1 row: 4/3/2/1) ===
let videoAllWorks = [];
let _videoPrevCols = 0;

function getVideoDigestCols() {
  const w = window.innerWidth;
  if (w >= 1179) return 4;   // PC〜4K
  if (w >= 891) return 3;   // 小型ノート
  if (w >= 603)  return 2;   // タブレット
  return 1;                  // スマホ
}

function renderVideoCards(works, containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container) return;

  const html = works.map(w => {
    const ym   = String(w.date).substring(0,6);
    const img  = `assets/gallery_${ym}/${w.image_filename}`;
    const mp4  = `assets/gallery_${ym}/vid_${w.date}.mp4`;
    const MP4  = `assets/gallery_${ym}/vid_${w.date}.MP4`; // フォールバック用

    return `
      <div class="gallery-card" data-month="${w.month}">
        <img src="${img}" alt="${w.title}" class="card-image" loading="lazy"
             data-video="${mp4}" data-video-alt="${MP4}">
        <div class="card-info">
          <h3 class="card-title">${w.title}</h3>
          <p class="card-description">${w.description}</p>
          <div class="gallery-icons">
            <span class="like-btn">♡ 0</span>
          </div>
        </div>
      </div>`;
  }).join('');

  container.innerHTML = html;
}

function refreshVideoDigest() {
  const grid = document.getElementById('video-digest-grid');
  if (!grid || !videoAllWorks.length) return;
  const cols = getVideoDigestCols();
  if (cols === _videoPrevCols && grid.children.length) return;
  _videoPrevCols = cols;
  // 1行表示：列数=表示数
  renderVideoCards(videoAllWorks.slice(0, cols), '#video-digest-grid');
  if (typeof setupLikeButtons === 'function') setupLikeButtons();
}

function onResizeVideoDigest() {
  const cols = getVideoDigestCols();
  if (cols !== _videoPrevCols) refreshVideoDigest();
}

function renderVideoDigest(works) {
  const grid = document.getElementById('video-digest-grid');
  if (!grid) return;

  // CSV/JSONのうち category=動画 を新しい順に
  videoAllWorks = (works || [])
    .filter(w => w.category === '動画')
    .sort((a,b) => Number(b.date) - Number(a.date));

  refreshVideoDigest();
  window.addEventListener('resize', onResizeVideoDigest);
}

// ===== 描画・UI 関数（既存ロジックを流用） =====
function renderGallery(works, containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container) return;

  const galleryHtml = works.map(work => {
    const yearMonth = String(work.date).substring(0, 6);
    const imagePath = `assets/gallery_${yearMonth}/${work.image_filename}`;
    let dataAttr = '';
    if (work.category === '動画') {
      const mp4 = `assets/gallery_${yearMonth}/vid_${work.date}.mp4`;
      const MP4 = `assets/gallery_${yearMonth}/vid_${work.date}.MP4`;
      dataAttr = ` data-video="${mp4}" data-video-alt="${MP4}"`;
    }
    return `
      <div class="gallery-card" data-month="${work.month}">
        <img src="${imagePath}" alt="${work.title}" class="card-image" loading="lazy"${dataAttr}>
        <div class="card-info">
          <h3 class="card-title">${work.title}</h3>
          <p class="card-description">${work.description}</p>
          <div class="gallery-icons">
            <span class="like-btn">♡ 0</span>
          </div>
        </div>
      </div>`;
  }).join('');
  container.innerHTML = galleryHtml;
}

function setupLikeButtons() {
  const likeButtons = document.querySelectorAll('.like-btn');
  likeButtons.forEach(button => {
    const card = button.closest('.gallery-card');
    if (!card) return;
    const imageElement = card.querySelector('.card-image');
    if (!imageElement) return;

    const likeId = 'like-' + imageElement.src;

    if (button.dataset.listenerAttached) return;

    const saved = localStorage.getItem(likeId);
    if (saved) {
      button.innerText = '♥ ' + saved;
      button.classList.add('is-liked');
    }

    button.addEventListener('click', () => {
      if (button.classList.contains('is-liked')) return;
      button.classList.add('is-liked');

      let current = parseInt(button.innerText.replace(/[♡♥]\s?/, '')) || 0;
      const next = current + 1;
      button.innerText = '♥ ' + next;
      localStorage.setItem(likeId, next);

      button.classList.add('is-popping');
      setTimeout(() => button.classList.remove('is-popping'), 300);
    });

    button.dataset.listenerAttached = 'true';
  });
}

function setupFilter(works){
  const bar = document.querySelector('.filter-bar');
  if (!bar) return;

  // 要素に表示データを保持（resizeで再構築するため）
  bar.__works = works.slice();
  const months = [...new Set(works.map(w => String(w.month)))].sort((a,b)=>a-b);

  // PC版UI
  const renderPC = () => {
    const monthBtns = months.map(m => `<button class="filter-btn" data-month="${m}">${m}月</button>`).join('');
    bar.innerHTML = `<button class="filter-btn is-active" data-month="all">全て表示</button>${monthBtns}`;
    bar.dataset.mode = 'pc';
    bindFilterButtons(bar, works);
  };

  // SP版UI（ページャ）
  const renderSP = () => {
    bar.innerHTML = `
      <div class="month-filter">
        <button class="filter-btn is-active" data-month="all">全て表示</button>
        <div class="month-pager" role="toolbar" aria-label="月の絞り込み">
          <button class="pager-btn prev" aria-label="前の月へ">‹</button>
          <div class="pager-window"></div>
          <button class="pager-btn next" aria-label="次の月へ">›</button>
        </div>
      </div>
      <div class="pager-dots" aria-hidden="true"></div>
    `;
    bar.dataset.mode = 'sp';

    const prevBtn = bar.querySelector('.pager-btn.prev');
    const nextBtn = bar.querySelector('.pager-btn.next');
    const winEl   = bar.querySelector('.pager-window');
    const dotsEl  = bar.querySelector('.pager-dots');

    // 現実解：窓幅からアイテム数を算出（切れ防止）
    const minChip = 66; // px（丸チップの最小想定幅）
    const calcItemsPerPage = () => {
      const w = winEl.getBoundingClientRect().width || 0;
      return Math.max(3, Math.min(4, Math.floor(w / minChip)));
    };

    let itemsPerPage = calcItemsPerPage();
    let page = 0;

    const renderPage = () => {
      const pageCount = Math.max(1, Math.ceil(months.length / itemsPerPage));
      page = Math.min(page, pageCount - 1);
      const start = page * itemsPerPage;
      const slice = months.slice(start, start + itemsPerPage);
      winEl.innerHTML = slice.map(m => `<button class="filter-btn" data-month="${m}">${m}月</button>`).join('');
      dotsEl.innerHTML = (pageCount <= 1) ? '' :
        Array.from({length: pageCount}, (_,i)=>`<span class="dot${i===page?' is-active':''}"></span>`).join('');
      prevBtn.disabled = (page === 0);
      nextBtn.disabled = (page >= pageCount - 1);
      bindFilterButtons(bar, works);
    };

    prevBtn.addEventListener('click', () => { if (page>0){ page--; renderPage(); } });
    nextBtn.addEventListener('click', () => {
      const nextItems = calcItemsPerPage(); // 念のため再測定
      if (nextItems !== itemsPerPage){ itemsPerPage = nextItems; }
      page++; renderPage();
    });

    // 初期描画
    renderPage();

    // 窓幅が変わったらアイテム数を再計算して再描画（向き/ズーム/ガター変化対策）
    const onResize = () => {
      const mql = window.matchMedia('(max-width: 768px)').matches;
      if (!mql) { renderPC(); attachResizeWatcher(); return; }
      const nextItems = calcItemsPerPage();
      if (nextItems !== itemsPerPage) { itemsPerPage = nextItems; renderPage(); }
    };
    window.addEventListener('resize', onResize, { passive:true });
  };

  // 現在幅で初期描画
  const isSP = window.matchMedia('(max-width: 768px)').matches;
  if (isSP) renderSP(); else renderPC();

  // PC⇄SPをまたぐときはUIを切替（多重バインド防止のため監視を一箇所に集約）
  function attachResizeWatcher(){
    if (bar.__resizeBound) return;
    bar.__resizeBound = true;
    let prevIsSP = isSP;
    window.addEventListener('resize', () => {
      const nowSP = window.matchMedia('(max-width: 768px)').matches;
      if (nowSP !== prevIsSP){
        prevIsSP = nowSP;
        // 保持したデータで再構築
        setupFilter(bar.__works || works);
      }
    }, { passive:true });
  }
  attachResizeWatcher();
}

function bindFilterButtons(root, works){
  const buttons = root.querySelectorAll('.filter-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', function(){
      buttons.forEach(b => b.classList.remove('is-active'));
      this.classList.add('is-active');
      const target = this.dataset.month;
      const filtered = (target === 'all') ? works : works.filter(w => String(w.month) === target);
      renderGallery(filtered, '#full-gallery-grid');
      setupLikeButtons();
    });
  });
}

function setupHamburgerMenu() {
  const btn = document.querySelector('.hamburger-menu');
  const nav = document.querySelector('.global-nav');
  if (!btn || !nav || btn.dataset.bound) return;   // 二重バインド防止

  btn.dataset.bound = '1';
  btn.setAttribute('aria-expanded', 'false');

  const _mc = document.querySelector('.mobile-center-menu');
  if (_mc) _mc.addEventListener('click', onToggle);

  const _mcc = document.querySelector('.mobile-center-menu-close');
  if (_mcc) _mcc.addEventListener('click', onClose);

  function onToggle() {
    const willOpen = !nav.classList.contains('active');
    btn.classList.toggle('active', willOpen);
    nav.classList.toggle('active', willOpen);
    btn.setAttribute('aria-expanded', String(willOpen));
  }

  function onClose() {
    nav.classList.remove('active');
    btn.classList.remove('active');
    btn.setAttribute('aria-expanded', 'false');
  }

  // PC幅に戻ったら自動で閉じる
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768 && nav.classList.contains('active')) {
      nav.classList.remove('active');
      btn.classList.remove('active');
      btn.setAttribute('aria-expanded', 'false');
    }
  });
}

function calcColumns() {
  const grid = document.getElementById('digest-gallery-grid');
  if (!grid) return 1;

  const firstCard = grid.querySelector('.gallery-card');
  const cardWidth = firstCard ? firstCard.getBoundingClientRect().width : 260;

  const style = window.getComputedStyle(grid);
  const gapX = parseInt(style.columnGap || style.gap || 0, 10);

  const gridW = grid.getBoundingClientRect().width;
  return Math.max(1, Math.floor((gridW + gapX) / (cardWidth + gapX)));
}

// ===== Self Test (Shift + D) =====
window.OrochiSelfTest = (() => {
  const bust = () => `?v=${Date.now()}`;
  const norm = c => (c === '動画' ? 'AI' : (c || ''));

  // CSV パーサ（クォート対応）
  function parseCSV(text) {
    text = text.replace(/\r/g, '');
    const lines = text.split('\n');
    if (!lines.length) return [];
    lines.shift();
    const out = [];
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      if (!line.trim()) continue;
      const cols = [];
      let cur = '', q = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { if (q && line[i+1] === '"') { cur += '"'; i++; } else { q = !q; } continue; }
        if (ch === ',' && !q) { cols.push(cur); cur=''; continue; }
        cur += ch;
      }
      cols.push(cur);
      if (cols.length < 4) continue;
      const rawDate = (cols[0]||'').trim();
      const digits  = rawDate.replace(/\D/g,'');
      if (!/^\d{8}$/.test(digits)) continue;
      out.push({
        id: li+1,
        date: digits,
        month: parseInt(digits.substring(4,6),10),
        title: (cols[1]||'').trim(),
        category: (cols[2]||'').trim(),
        description: (cols[3]||'').trim(),
        image_filename: `img_${digits}.png`,
      });
    }
    return out;
  }

  async function headOK(url) {
    try {
      const r = await fetch(url + bust(), { cache: 'no-store' });
      return { ok: r.ok, status: r.status };
    } catch (e) {
      return { ok: false, status: 0, error: e.message };
    }
  }

  function merge(jsonArr=[], csvArr=[]) {
    const map = new Map();
    for (const w of jsonArr || []) if (w?.date) map.set(String(w.date), { ...w, category: norm(w.category) });
    let overwrites = 0;
    for (const w of csvArr || []) if (w?.date) {
      const k = String(w.date);
      if (map.has(k)) overwrites++;
      map.set(k, { ...w, category: norm(w.category) });
    }
    const merged = Array.from(map.values()).sort((a,b)=>Number(b.date)-Number(a.date));
    return { merged, overwrites };
  }

  function ensureStyle() {
    if (document.getElementById('orochi-selftest-style')) return;
    const css = `
      .orochi-selftest-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9998;}
      .orochi-selftest-modal{position:fixed;inset:auto;left:50%;top:10%;transform:translateX(-50%);width:min(720px,92vw);background:#1e1930;color:#fff;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,.35);z-index:9999;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}
      .orochi-selftest-header{padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.12);display:flex;align-items:center;gap:12px}
      .orochi-selftest-title{font-size:18px;font-weight:700}
      .orochi-selftest-body{padding:16px 20px;max-height:60vh;overflow:auto}
      .orochi-selftest-list{list-style:none;padding:0;margin:0;display:grid;gap:10px}
      .orochi-selftest-item{padding:12px;border-radius:12px;background:rgba(255,255,255,.06);display:flex;gap:12px;align-items:flex-start}
      .orochi-selftest-badge{min-width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700}
      .ok{background:#12b886;color:#0c2f23}
      .ng{background:#ff6b6b;color:#3d0a0a}
      .orochi-selftest-footer{padding:12px 20px;border-top:1px solid rgba(255,255,255,.12);display:flex;justify-content:flex-end;gap:8px}
      .orochi-selftest-btn{background:#372e51;border:none;color:#fff;border-radius:10px;padding:8px 14px;font-weight:600;cursor:pointer}
      .orochi-selftest-btn:hover{filter:brightness(1.05)}
      .orochi-selftest-summary{font-size:16px;font-weight:700}
    `;
    const style = document.createElement('style');
    style.id = 'orochi-selftest-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function show(results) {
    ensureStyle();
    const backdrop = document.createElement('div');
    backdrop.className = 'orochi-selftest-backdrop';
    const modal = document.createElement('div');
    modal.className = 'orochi-selftest-modal';

    const okAll = results.items.every(i => i.ok);
    const summary = okAll ? '🎉 ALL PASS' : '⚠️ 要確認があります';

    modal.innerHTML = `
      <div class="orochi-selftest-header">
        <div class="orochi-selftest-title">開運オロチ 自己診断</div>
        <div class="orochi-selftest-summary">${summary}</div>
      </div>
      <div class="orochi-selftest-body">
        <ul class="orochi-selftest-list">
          ${results.items.map(i => `
            <li class="orochi-selftest-item">
              <div class="orochi-selftest-badge ${i.ok?'ok':'ng'}">${i.ok?'✓':'!'}</div>
              <div>
                <div><b>${i.label}</b></div>
                <div style="opacity:.85">${i.detail || ''}</div>
              </div>
            </li>
          `).join('')}
        </ul>
      </div>
      <div class="orochi-selftest-footer">
        <button class="orochi-selftest-btn" data-close>閉じる (Esc)</button>
      </div>
    `;
    function close(){ backdrop.remove(); modal.remove(); }
    backdrop.addEventListener('click', close);
    modal.querySelector('[data-close]').addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); }, { once:true });

    document.body.appendChild(backdrop);
    document.body.appendChild(modal);
  }

  async function run() {
    const results = { items: [] };

    // 1) favicon
    const rIco = await headOK('favicon.ico');
    results.items.push({ ok: rIco.ok, label: 'favicon.ico', detail:`status=${rIco.status}` });

    // 2) works.json
    let json = [];
    let rJson = await headOK('オロチポートフォリオ文字データ/works.json');
    if (rJson.ok) {
      try {
        const res = await fetch('オロチポートフォリオ文字データ/works.json' + bust(), { cache:'no-store' });
        json = await res.json();
      } catch {}
    }
    results.items.push({ ok: rJson.ok, label: 'works.json 取得', detail:`count=${json.length} status=${rJson.status}` });

    // 3) CSV
    let csv = [];
    let rCsv = await headOK('オロチポートフォリオ文字データ/オロチポートフォリオ表.csv');
    if (rCsv.ok) {
      try {
        const res = await fetch('オロチポートフォリオ文字データ/オロチポートフォリオ表.csv' + bust(), { cache:'no-store' });
        csv = parseCSV(await res.text());
      } catch {}
    }
    results.items.push({ ok: rCsv.ok, label: 'CSV 取得/解析', detail:`count=${csv.length} status=${rCsv.status}` });

    // 4) マージ（CSV優先）
    const { merged, overwrites } = merge(json, csv);
    results.items.push({ ok: merged.length > 0, label: 'マージ結果', detail:`merged=${merged.length} csvOverwrite=${overwrites}` });

    // 5) months
    const months = [...new Set(merged.map(w=>w.month))].sort((a,b)=>a-b);
    results.items.push({ ok: months.length > 0, label: '月フィルタ', detail:`months=[${months.join(',')}]` });

    // 6) カテゴリ正規化
    const stillVideo = merged.filter(w => w.category === '動画').length;
    results.items.push({ ok: stillVideo === 0, label: 'カテゴリ正規化（動画→AI）', detail:`残存動画=${stillVideo}` });

    // 7) 直近3件の画像存在
    let imgOK = true, details = [];
    for (const w of merged.slice(0,3)) {
      const p = `assets/gallery_${w.date.slice(0,6)}/${w.image_filename}`;
      const r = await headOK(p);
      imgOK = imgOK && r.ok;
      details.push(`${p} ${r.status}`);
    }
    results.items.push({ ok: imgOK, label: '最新画像 3 件', detail: details.join(' | ') });

    show(results);
    return results;
  }

  // Shortcut
  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'd' && e.shiftKey) {
      run();
    }
  });

  return { run };
})();

/* ==== Lightbox (image + video) ========================================== */
(function () {
  const GRIDS = ['#digest-gallery-grid', '#ai-digest-grid', '#video-digest-grid', '#full-gallery-grid'];
  let overlay, imgEl, videoEl, captionEl, currentList = [], currentIndex = -1;

  function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'orochi-lightbox';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
      <div class="orochi-lightbox__content" aria-live="polite">
        <button class="orochi-lightbox__close" aria-label="閉じる">✕</button>
        <button class="orochi-lightbox__prev" aria-label="前へ">‹</button>
        <img class="orochi-lightbox__img" alt="">
        <video class="orochi-lightbox__video" style="display:none" playsinline controls></video>
        <button class="orochi-lightbox__next" aria-label="次へ">›</button>
        <div class="orochi-lightbox__caption"></div>
      </div>`;
    document.body.appendChild(overlay);
    imgEl     = overlay.querySelector('.orochi-lightbox__img');
    videoEl   = overlay.querySelector('.orochi-lightbox__video');
    captionEl = overlay.querySelector('.orochi-lightbox__caption');

    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('.orochi-lightbox__close').addEventListener('click', close);
    overlay.querySelector('.orochi-lightbox__prev').addEventListener('click', () => step(-1));
    overlay.querySelector('.orochi-lightbox__next').addEventListener('click', () => step(1));

    document.addEventListener('keydown', e => {
      if (!overlay.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    });
  }

  function collect(container) { return Array.from(container.querySelectorAll('img.card-image')); }

  function captionFor(img) {
    const card  = img.closest('.gallery-card');
    const title = card?.querySelector('.card-title')?.textContent?.trim() || img.alt || '';
    const desc  = card?.querySelector('.card-description')?.textContent?.trim() || '';
    return [title, desc].filter(Boolean).join(' — ');
  }

  function openFrom(img, list) {
    ensureOverlay();
    currentList = list;
    currentIndex = Math.max(0, currentList.indexOf(img));
    show();
    document.body.classList.add('modal-open');
    overlay.classList.add('open');
  }

  function setVideoSrcWithFallback(lower, upper) {
    videoEl.pause();
    videoEl.src = lower;
    let triedUpper = false;
    videoEl.onerror = () => {
      if (upper && !triedUpper) {
        triedUpper = true;
        videoEl.src = upper;
        videoEl.play().catch(()=>{});
      }
    };
    videoEl.currentTime = 0;
    videoEl.play().catch(()=>{});
  }

  function show() {
    const cur = currentList[currentIndex];
    if (!cur) return close();

    const lower   = cur.getAttribute('data-video');      // .mp4
    const upper   = cur.getAttribute('data-video-alt');  // .MP4
    const caption = captionFor(cur);
    captionEl.textContent = caption;

    if (lower) {
      // 動画モード
      imgEl.style.display = 'none';
      videoEl.style.display = '';
      setVideoSrcWithFallback(lower, upper);
    } else {
      // 画像モード
      videoEl.pause(); videoEl.removeAttribute('src'); videoEl.style.display = 'none';
      imgEl.style.display = '';
      imgEl.src = cur.currentSrc || cur.src;
      imgEl.alt = cur.alt || '';
    }

    overlay.querySelector('.orochi-lightbox__prev').disabled = (currentIndex <= 0);
    overlay.querySelector('.orochi-lightbox__next').disabled = (currentIndex >= currentList.length - 1);
  }

  function step(d) {
    const n = currentIndex + d;
    if (n < 0 || n >= currentList.length) return;
    currentIndex = n;
    show();
  }

  function close() {
    overlay.classList.remove('open');
    document.body.classList.remove('modal-open');
    videoEl.pause(); videoEl.removeAttribute('src');
    imgEl.removeAttribute('src');
    captionEl.textContent = '';
    currentList = []; currentIndex = -1;
  }

  function onGridClick(e) {
    const img = e.target.closest('img.card-image');
    if (!img) return;
    openFrom(img, collect(e.currentTarget));
  }

  // すべてのグリッドに委任（重複バインド防止フラグ付き）
  (function init(){
    const bind = sel => { const g = document.querySelector(sel); if (g && !g.__lb) { g.addEventListener('click', onGridClick); g.__lb = true; } };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => GRIDS.forEach(bind));
    } else {
      GRIDS.forEach(bind);
    }
  })();
})();

function markCurrentNav(){
  const bodyId = document.body.id || "";
  // サブメニューのアンカー
  const linkIllust = document.querySelector('.subnav a[href$="gallery.html"]');
  const linkAI     = document.querySelector('.subnav a[href$="toki-sude-ni-orochi.html"]');
  const linkVideo  = document.querySelector('.subnav a[href$="video.html"]');
  const parentItem = document.querySelector('.global-nav li.has-sub > a');

  // すべての current をリセット
  [linkIllust, linkAI, linkVideo].forEach(a => {
    if (!a) return;
    a.classList.remove('is-current');
    a.removeAttribute('aria-current');
  });
  if (parentItem) parentItem.parentElement.classList.remove('is-current');

  // body id に応じて付与
  let target = null;
  if (bodyId === 'page-gallery')        target = linkIllust;
  else if (bodyId === 'page-ai-gallery')    target = linkAI;
  else if (bodyId === 'page-video-gallery') target = linkVideo;

  if (target) {
    target.classList.add('is-current');
    target.setAttribute('aria-current', 'page');  // アクセシビリティ対応
    if (parentItem) parentItem.parentElement.classList.add('is-current');
  }
}

/* ==== Header auto hide on hero section (TOP only) ==== */
function setupHeaderAutoHide(){
  const header = document.querySelector('.global-header');
  const hero   = document.querySelector('#key-visual, .hero-section');
  if (!header || !hero) return; // ヒーローが無い下層ページは何もしない

  // ハンバーガー展開中は強制表示
  const btn = document.querySelector('.hamburger-menu');
  const nav = document.querySelector('.global-nav');
  if (btn && nav){
    btn.addEventListener('click', () => {
      const open = nav.classList.contains('active');
      header.classList.toggle('force-show', open);
      if (open) header.classList.remove('is-hidden');
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768){
        header.classList.remove('force-show');
      }
    });
  }

  // ヒーローが画面にある間はヘッダーを隠す
  const io = new IntersectionObserver(
    (entries) => {
      const e = entries[0];
      // 20% 以上可視 → 隠す / それ未満 → 表示
      if (!header.classList.contains('force-show')){
        header.classList.toggle('is-hidden', e.isIntersecting && e.intersectionRatio >= 0.2);
      }
    },
    { root: null, threshold: [0, 0.2, 1] }
  );
  io.observe(hero);
}

/* === Shrink header–hero gap to 50% (no SVG size change) =============== */
(function shrinkHeaderHeroGapByHalf(){
  const header = document.querySelector('header.global-header');
  // ヒーロー候補を幅広く探索（idが無くても拾う）
  const hero = document.querySelector('#hero, section.hero, .hero-section, .hero, [data-hero]');
  if (!header || !hero) return;              // 他ページは無効化

  // 実測→translateYで“見た目だけ”上に寄せる（サイズ・レイアウト不変）
  function measureAndApply() {
    // ヘッダー下端とヒーロー上端のページ基準位置
    const headerBottom = header.getBoundingClientRect().bottom + window.scrollY;
    const heroTop      = hero.getBoundingClientRect().top + window.scrollY;

    const gap = Math.max(0, heroTop - headerBottom);  // 現在のギャップpx
    const lift = Math.round(gap * 0.5);               // ちょうど半分

    // 既存transformとの合成：translateYだけ前段に追加（他のscale等は不変）
    const prev = getComputedStyle(hero).transform;
    // matrix(...) or 'none' を考慮して、translateYだけを前段で足す
    hero.style.transform = `translateY(${-lift}px)` + (prev && prev !== 'none' ? ' ' + prev : '');
    hero.style.willChange = 'transform';
    hero.style.position = hero.style.position || 'relative'; // レイヤ順の保険
    hero.style.zIndex = hero.style.zIndex || '0';
  }

  // 初回：load完了（画像/SVG読み込み後）の次フレームで正確に適用
  window.addEventListener('load', () => requestAnimationFrame(measureAndApply), { once: true });
  // リサイズや向き変更時は再計測
  window.addEventListener('resize', () => requestAnimationFrame(measureAndApply));
  window.addEventListener('orientationchange', () => requestAnimationFrame(measureAndApply));
})();

/* === Splash fade logic =============================================== */
(function splashZoomFade(){
  const splash = document.getElementById('splash');
  if(!splash) return;

  window.addEventListener('load', () => {
    setTimeout(() => {
      splash.classList.add('zoom-fade');      // ← 新クラス名
      setTimeout(() => splash.remove(), 800); // 0.8s 後に削除
    }, 700);                                  // 表示 0.7s
  });
})();

// ridge左端をsubject右端に合わせる（横幅に追随）
(function(){
  function setRidgeOffset(){
    const subject = document.querySelector('.global-header .header-subject');
    if(!subject) return;
    // 画像の実表示幅を取得（小数切り上げで1pxズレ防止）
    const w = Math.ceil(subject.getBoundingClientRect().width);
    document.documentElement.style.setProperty('--subject-w', w + 'px');
  }
  window.addEventListener('DOMContentLoaded', setRidgeOffset);
  window.addEventListener('resize', setRidgeOffset);
})();

/* === Tighten header–hero gap by 50% (safe; no SVG change) ============== */
(function tightenHeaderHeroGap(){
  const header = document.querySelector('header.global-header');
  const hero = document.querySelector('#hero, section.hero, .hero-section, .hero'); // どれかが命中
  if (!header || !hero) return; // 他ページは自動無効化

  // 実測→translateYで“見た目だけ”上に寄せる（サイズ・レイアウト不変）
  function measureAndApply() {
    // ヘッダー下端とヒーロー上端のページ基準位置
    const headerBottom = header.getBoundingClientRect().bottom + window.scrollY;
    const heroTop      = hero.getBoundingClientRect().top + window.scrollY;

    const gap = Math.max(0, heroTop - headerBottom);  // 現在のギャップpx
    const lift = Math.round(gap * 0.5);               // ちょうど半分

    // 既存transformとの合成：translateYだけ前段に追加（他のscale等は不変）
    const prev = getComputedStyle(hero).transform;
    // matrix(...) or 'none' を考慮して、translateYだけを前段で足す
    hero.style.transform = `translateY(${-lift}px)` + (prev && prev !== 'none' ? ' ' + prev : '');
    hero.style.willChange = 'transform';
    hero.style.position = hero.style.position || 'relative'; // レイヤ順の保険
    hero.style.zIndex = hero.style.zIndex || '0';
  }

  // 初回：load完了（画像/SVG読み込み後）の次フレームで正確に適用
  window.addEventListener('load', () => requestAnimationFrame(measureAndApply), { once: true });
  // リサイズや向き変更時は再計測
  window.addEventListener('resize', () => requestAnimationFrame(measureAndApply));
  window.addEventListener('orientationchange', () => requestAnimationFrame(measureAndApply));
})();

/* === Halve the gap between header and hero (safe; keeps SVG size) === */
(function halveHeaderHeroGap(){
  const header = document.querySelector('header.global-header');
  if(!header) return;

  // 1) ヒーロー候補を堅牢に探索（id, class, data-hero）
  let hero =
    document.querySelector('#hero, section.hero, .hero-section, .hero, [data-hero]') ||
    (header.nextElementSibling && !header.nextElementSibling.classList.contains('header-ridge-row')
      ? header.nextElementSibling
      : null);
  if(!hero) return;

  // 2) 元の transform を保存（再適用時に加算しないため）
  if(!hero.dataset.origTransform){
    const t = getComputedStyle(hero).transform;
    hero.dataset.origTransform = (t && t !== 'none') ? t : '';
  }

  function apply(){
    const headerBottom = header.getBoundingClientRect().bottom + window.scrollY;
    const heroTop      = hero.getBoundingClientRect().top + window.scrollY;
    const gap          = Math.max(0, heroTop - headerBottom);   // いまのギャップ(px)
    const lift         = Math.round(gap * 0.5);                  // 50%だけ詰める
    const value        = `translateY(${-lift}px)` + (hero.dataset.origTransform ? ` ${hero.dataset.origTransform}` : '');

    // !important で確実に上書き（他CSSに transform:...!important があっても勝つ）
    hero.style.setProperty('transform', value, 'important');
    hero.style.willChange = 'transform';
    if(!hero.style.position) hero.style.position = 'relative';
    if(!hero.style.zIndex)   hero.style.zIndex   = '0';
  }

  // 初回：load後の次フレームで実寸計測→適用
  const run = () => requestAnimationFrame(apply);
  if (document.readyState === 'complete') {
    run();
  } else {
    window.addEventListener('load', run, { once:true });
  }

  // 画面変化にも追随
  window.addEventListener('resize', run);
  window.addEventListener('orientationchange', run);

  // レイアウトが後から変わるケースにも対処（任意：軽量）
  const obs = new MutationObserver(()=> requestAnimationFrame(measureAndApply));
  obs.observe(document.documentElement, {subtree:true, attributes:true, attributeFilter:['style','class']});
  // 5秒後に監視を停止（十分伝播した後は不要）
  setTimeout(()=> obs.disconnect(), 5000);
})();

/* === Intro text (#hero-intro) fades out on scroll until main ========== */
(function fadeIntroOnScroll(){
  // 対象（存在しないページでは自動無効化）
  const intro = document.querySelector('#hero-intro');
  const main  = document.querySelector('#main-content') || document.querySelector('main');
  if (!intro || !main) return;

  // 親コンテナの透明度だけ制御（子の個別アニメはそのまま乗算される）
  intro.style.willChange = 'opacity';

  // main に触れる直前で 0 にしたい場合は 20〜40 に
  const FINISH_OFFSET = 0;

  let startY = 0, endY = 1, total = 1, raf = null;

  function measure(){
    // ページ基準位置を再計測（フォント・画像読み込み後の変動にも耐性）
    const introTop = intro.getBoundingClientRect().top + window.scrollY;
    const mainTop  = main.getBoundingClientRect().top + window.scrollY;

    startY = introTop;
    endY   = Math.max(introTop + 1, mainTop - FINISH_OFFSET);
    total  = Math.max(1, endY - startY);

    update();
  }

  function update(){
    const y = window.scrollY;
    const t = Math.min(Math.max((y - startY) / total, 0), 1); // 0→1
    const op = 1 - t;                                         // 1→0

    // 親にだけ適用（!important で他CSSに勝つ）
    intro.style.setProperty('opacity', op.toFixed(3), 'important');
    intro.style.pointerEvents = (op < 0.05) ? 'none' : '';
    raf = null;
  }

  function onScroll(){ if (!raf) raf = requestAnimationFrame(update); }

  // レイアウト変動に追随（画像・フォント・サイズ変更など）
  window.addEventListener('scroll', onScroll, { passive:true });
  window.addEventListener('resize', measure);
  window.addEventListener('orientationchange', measure);

  // イントロ内部のテキストが差し替わる場合に備えて監視（高さ変化に追随）
  const mo = new MutationObserver(measure);
  mo.observe(intro, { childList:true, subtree:true, attributes:true, attributeFilter:['style','class'] });

  // スプラッシュや画像読み込み完了後の実寸で開始
  if (document.readyState === 'complete') measure();
  else window.addEventListener('load', measure, { once:true });
})();

/* ===================== Mobile center menu panel under header ===================== */
(function setupMobileCenterMenu(){
  const header = document.querySelector('header.global-header');
  const btn = header ? header.querySelector('.hamburger-menu') : null;
  if(!header || !btn) return; // ないページでは何もしない（安全）

  const html = document.documentElement;

  // --- パネル生成（既存デスクトップナビから項目を抽出） ---
  let panel = null;
  function liOf(a){
    const li = document.createElement('li');
    const link = a.cloneNode(true);
    link.removeAttribute('id');
    li.appendChild(link);
    return li;
  }
  function buildPanel(){
    if(panel) return panel;

    panel = document.createElement('nav');
    panel.className = 'mobile-menu-panel';
    panel.setAttribute('aria-label', 'Mobile menu');

    const box = document.createElement('div');
    box.className = 'menu-box';

    const ul = document.createElement('ul');
    ul.className = 'menu-list';

    const desktopMenu = header.querySelector('.global-nav .menu');
    if (desktopMenu){
      const hon  = desktopMenu.querySelector('a[href$="index.html"]');
      if(hon) ul.appendChild(liOf(hon));

      const sub  = desktopMenu.querySelector('.has-submenu .submenu, .subnav, .submenu');
      if(sub) sub.querySelectorAll('a').forEach(a => ul.appendChild(liOf(a)));

      const x    = desktopMenu.querySelector('.icon-link.x');
      if(x) ul.appendChild(liOf(x));

      const shop = desktopMenu.querySelector('.icon-link.shop');
      if(shop) ul.appendChild(liOf(shop));
    }

    box.appendChild(ul);
    panel.appendChild(box);
    header.insertAdjacentElement('afterend', panel);
    return panel;
  }

  // --- ヘッダー下端の位置を CSS 変数に反映（パネルの固定位置に使用） ---
  function updateHeaderBottom(){
    const r = header.getBoundingClientRect();
    html.style.setProperty('--header-bottom', (r.bottom + window.scrollY) + 'px');
  }
  updateHeaderBottom();
  window.addEventListener('resize', updateHeaderBottom);
  window.addEventListener('orientationchange', updateHeaderBottom);

  // --- クリック外し用のオーバーレイ（DOMに一度だけ追加） ---
  const overlay = document.createElement('div');
  // CSSはここで完結させ、既存CSSへ影響させない
  overlay.style.position = 'fixed';
  overlay.style.inset    = '0';
  overlay.style.zIndex   = '940';       // ヘッダー(1000) < パネル(950) より下、ページより上
  overlay.style.display  = 'none';
  overlay.style.background = 'transparent';
  overlay.style.touchAction = 'manipulation';
  overlay.setAttribute('aria-hidden', 'true');
  document.body.appendChild(overlay);

  // --- 開閉制御（html に is-menu-open を付与/除去） ---
  function open(){
    buildPanel();
    updateHeaderBottom();
    html.classList.add('is-menu-open');       // 既存CSSがスクロールを止める前提（header-white.css）
    overlay.style.display = 'block';
    panel.style.display   = 'block';
    btn.setAttribute('aria-expanded', 'true');
  }
  function close(){
    html.classList.remove('is-menu-open');
    overlay.style.display = 'none';
    if(panel) panel.style.display = 'none';
    btn.setAttribute('aria-expanded', 'false');
  }
  function isOpen(){ return overlay.style.display === 'block'; }

  // --- トグルボタン ---
  btn.addEventListener('click', (e)=>{
    e.stopPropagation();
    isOpen() ? close() : open();
  });

  // --- どこでもタップ/クリックで閉じる（外側なら） ---
  overlay.addEventListener('click', close);
  overlay.addEventListener('touchstart', (e)=>{ e.preventDefault(); close(); }, {passive:false});

  // 念のためドキュメント全域でも捕捉（キャプチャ段階で先取り）
  document.addEventListener('pointerdown', (e)=>{
    if (!isOpen() || !panel) return;
    if (panel.contains(e.target) || btn.contains(e.target)) return;
    close();
  }, true);

  // ESCキーでも閉じる
  window.addEventListener('keydown', (e)=>{ if(e.key === 'Escape' && isOpen()) close(); });

})();

/* === Video digest OVERRIDE: 1179px まで4列を維持 =================== */
/* 既存ロジックは触らず「列数判定」だけを上書き。描画は既存の refreshVideoDigest() を使用。 */
(() => {
  const MIN_CARD = 260;  // styles.css のカード最小幅（実数と整合）
  const GAP      = 28;   // 同上：カード間ギャップ

  function getVideoDigestCols() {
    const grid = document.getElementById('video-digest-grid');

    // 初期計測が難しいタイミング向けフォールバック（ウィンドウ幅基準）。
    // ★要件：1179px までは 4列 を維持
    const fallback = () => {
      const w = window.innerWidth || 0;
      if (w >= 1179) return 4;
      if (w >= 891)  return 3;
      if (w >= 603)  return 2;
      return 1;
    };

    if (!grid) return fallback();

    // 可能ならコンテナ実幅から列数を算出（より堅牢）
    let width = grid.getBoundingClientRect().width || 0;
    if (!width && grid.parentElement) {
      width = grid.parentElement.getBoundingClientRect().width || 0;
    }
    if (!width) return fallback();

    // コンテナ幅から（260px＋28px）を並べられる数を計算。最大4列。
    const cols = Math.floor((width + GAP) / (MIN_CARD + GAP));
    return Math.max(1, Math.min(4, cols));
  }

  // 既存の参照先を、この実装に差し替え
  window.getVideoDigestCols = getVideoDigestCols;

  // 反映を即座に確認するため、1回だけ再描画を試みる（存在チェック付き）
  try { if (typeof refreshVideoDigest === 'function') refreshVideoDigest(); } catch(_) {}
})();

/* === [FINAL OVERRIDE] VideoDigest cols: 4/3/2/1 @ 1179/891/603 ====== */
/* 列数判定だけを差し替え。描画は既存の refreshVideoDigest() を使用。 */
(() => {
  function finalVideoCols() {
    const w = window.innerWidth || 0;
    if (w >= 1179) return 4;  // 4枚 … 1179px以上
    if (w >= 891)  return 3;  // 3枚 … 891〜1178px  ← ★今回ここまで3枚
    if (w >= 603)  return 2;  // 2枚 … 603〜890px
    return 1;                 // 1枚 … 〜602px
  }

  // 列数関数を最終上書き
  window.getVideoDigestCols = finalVideoCols;

  // 旧定義で初期描画されていても、ロード完了後に1回だけ正しい列数で再描画
  window.addEventListener('load', () => {
    try {
      if (typeof refreshVideoDigest === 'function') {
        // 既存の“前回列数キャッシュ”がある環境でも確実に再描画されるよう保険
        if (typeof window._videoPrevCols !== 'undefined') window._videoPrevCols = -1;
        refreshVideoDigest();
      }
    } catch(_){}
  });

  // 確認用ログ（不要なら後で削除OK）
  try { console.info('[VideoDigest] final override active (4/3/2/1 @ 1179/891/603)'); } catch(_){}
})();

/* === [FINAL OVERRIDE] VideoDigest cols: 4/3/2/1 @ 1179/891/603 ====== */
(() => {
  function finalVideoCols() {
    const w = window.innerWidth || 0;
    if (w >= 1179) return 4;
    if (w >= 891)  return 3;  // ← 要件
    if (w >= 603)  return 2;
    return 1;
  }
  window.getVideoDigestCols = finalVideoCols;
  window.addEventListener('load', () => {
    try {
      if (typeof refreshVideoDigest === 'function') {
        if (typeof window._videoPrevCols !== 'undefined') window._videoPrevCols = -1;
        refreshVideoDigest();
      }
    } catch {}
  });
})();

// 未定義でも例外にしない無害スタブ（既にあれば上書きしない）
if (typeof window.measureAndApply !== 'function') {
  window.measureAndApply = function(){ /* no-op */ };
}

// Performance helper functions
function rafThrottle(fn) {
  let rafId = null;
  return function (...args) {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      fn.apply(this, args);
      rafId = null;
    });
  };
}

function addPassive(el, type, handler) {
  el.addEventListener(type, handler, { passive: true });
}