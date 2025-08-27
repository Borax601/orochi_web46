import sharp from 'sharp';

const SRC  = 'assets/wagara-bg.png';
const DEST = 'assets/wagara-tile.png';

(async () => {
  await sharp(SRC)
    .resize(256, 256, { fit: 'cover', position: 'center' })
    .toFile(DEST);
  console.log(`✅ ${DEST} created`);
})();

document.addEventListener('click', function(e){
  const a = e.target.closest('.global-nav a');
  if(!a) return;
  const isExternal = /^https?:\/\//.test(a.getAttribute('href'));
  const isIcon = a.classList.contains('icon-link');
  // 外部リンクやアイコンリンクは妨げない
  if(isExternal || isIcon) return;
  // それ以外（サブメニューのトグル等）だけ既存のpreventDefaultを適用
}, true);
