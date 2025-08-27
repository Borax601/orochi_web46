// 🔥 Firebase Realtime Database いいねシステム - 完全版
class SimpleLikeManager {
  constructor() {
    this.db = null;
    this.userId = this.generateUserId();
    this.processing = new Set();
    this.initFirebase();
  }

  generateUserId() {
    let userId = localStorage.getItem('orochiUserId');
    if (!userId) {
      userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('orochiUserId', userId);
    }
    return userId;
  }

  async initFirebase() {
    console.log('🔥 Firebase初期化開始...');
    
    try {
      // Firebase設定
      const firebaseConfig = {
        apiKey: "AIzaSyDgGLO59I3GxWxhvavAKTY1vk5kLWsSH-k",
        authDomain: "orochi-shrine-likes.firebaseapp.com",
        databaseURL: "https://orochi-shrine-likes-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "orochi-shrine-likes",
        storageBucket: "orochi-shrine-likes.firebasestorage.app",
        messagingSenderId: "459406898781",
        appId: "1:459406898781:web:714a214abc0782a577ffb4"
      };

      // Firebase初期化
      const app = firebase.initializeApp(firebaseConfig);
      this.db = firebase.database();
      
      console.log('✅ Firebase初期化完了');
      
      // 少し待ってからイベントバインド
      setTimeout(() => this.bindLikeEvents(), 1000);
      
    } catch (error) {
      console.error('❌ Firebase初期化エラー:', error);
    }
  }

  bindLikeEvents() {
    const likeButtons = document.querySelectorAll('.like-btn');
    console.log(`👆 ${likeButtons.length}個のいいねボタンを発見`);

    likeButtons.forEach((btn, index) => {
      // 重複バインド防止
      if (btn.dataset.likesBound) return;
      btn.dataset.likesBound = 'true';

      // workIdを抽出して保存
      const workId = this.extractWorkId(btn);
      if (workId) {
        btn.dataset.workId = workId;
        
        // 初期カウントを読み込み
        this.loadInitialCount(workId, btn);
        
        // クリックイベント
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.handleLikeClick(workId, btn);
        });
      }
    });
  }

  extractWorkId(btn) {
    const card = btn.closest('.gallery-card');
    if (!card) return null;
    
    const img = card.querySelector('.card-image, img');
    if (!img || !img.src) return null;
    
    const match = img.src.match(/img_(\d{8})\./);
    return match ? match[1] : null;
  }

  async loadInitialCount(workId, btn) {
    try {
      const countRef = this.db.ref(`likes/${workId}/count`);
      const userRef = this.db.ref(`likes/${workId}/users/${this.userId}`);
      
      const [countSnap, userSnap] = await Promise.all([
        countRef.once('value'),
        userRef.once('value')
      ]);
      
      const count = countSnap.val() || 0;
      const isLiked = userSnap.exists();
      
      this.updateButtonUI(btn, isLiked, count);
      
    } catch (error) {
      console.error('初期カウント読み込みエラー:', error);
    }
  }

  async handleLikeClick(workId, btn) {
    // 重複処理防止
    if (this.processing.has(workId)) {
      console.log('⏳ 処理中につきスキップ:', workId);
      return;
    }

    this.processing.add(workId);
    console.log('👆 いいね処理開始:', workId);

    try {
      const userRef = this.db.ref(`likes/${workId}/users/${this.userId}`);
      const countRef = this.db.ref(`likes/${workId}/count`);
      
      // 現在の状態を確認
      const userSnap = await userRef.once('value');
      const isCurrentlyLiked = userSnap.exists();
      
      if (isCurrentlyLiked) {
        // いいね解除
        await userRef.remove();
        await this.db.ref(`likes/${workId}/count`).transaction(currentCount => {
          return Math.max(0, (currentCount || 1) - 1);
        });
        console.log('💔 いいね解除:', workId);
      } else {
        // いいね追加
        await userRef.set(true);
        await this.db.ref(`likes/${workId}/count`).transaction(currentCount => {
          return (currentCount || 0) + 1;
        });
        console.log('❤️ いいね追加:', workId);
      }
      
      // 最新カウントでUI更新
      const finalCount = await countRef.once('value');
      this.updateButtonUI(btn, !isCurrentlyLiked, finalCount.val() || 0);
      
    } catch (error) {
      console.error('❌ いいね処理エラー:', error);
    } finally {
      // 処理フラグを即座解除
      this.processing.delete(workId);
    }
  }

  updateButtonUI(btn, isLiked, count) {
    const icon = isLiked ? '♥' : '♡';
    btn.textContent = `${icon} ${count}`;
    btn.classList.toggle('liked', isLiked);
    
    if (isLiked) {
      btn.classList.add('is-popping');
      setTimeout(() => btn.classList.remove('is-popping'), 300);
    }
    
    console.log(`🎨 UI更新: ${btn.dataset.workId} = ${count} (${isLiked ? 'liked' : 'not liked'})`);
  }
}

// Firebase SDKの読み込み待機
let likeManager = null;

function initLikeSystem() {
  if (typeof firebase !== 'undefined' && firebase.database) {
    console.log('🚀 いいねシステム開始');
    likeManager = new SimpleLikeManager();
  } else {
    console.log('⏳ Firebase SDK待機中...');
    setTimeout(initLikeSystem, 500);
  }
}

// DOMContentLoaded後に初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLikeSystem);
} else {
  initLikeSystem();
}