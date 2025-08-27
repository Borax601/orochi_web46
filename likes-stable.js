// 🔥 Firebase いいねシステム - 安定版
class StableLikeManager {
  constructor() {
    this.db = null;
    this.userId = this.generateUserId();
    this.processing = new Map(); // Set → Map に変更（詳細な状態管理）
    this.initialized = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    
    console.log('🚀 安定版いいねシステム開始');
    this.initFirebase();
  }

  generateUserId() {
    let userId = localStorage.getItem('orochiUserId');
    if (!userId) {
      userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('orochiUserId', userId);
    }
    console.log('👤 ユーザーID:', userId);
    return userId;
  }

  async initFirebase() {
    if (this.initialized) return;
    
    try {
      console.log('🔥 Firebase初期化開始...');
      
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
      this.initialized = true;
      
      console.log('✅ Firebase初期化完了');
      
      // 接続テスト
      await this.testConnection();
      
      // DOM準備を待ってイベントバインド
      this.waitForDOMReady();
      
    } catch (error) {
      console.error('❌ Firebase初期化エラー:', error);
      this.retryCount++;
      if (this.retryCount <= this.maxRetries) {
        console.log(`🔄 ${this.retryCount}回目のリトライ...`);
        setTimeout(() => this.initFirebase(), 2000);
      }
    }
  }

  async testConnection() {
    try {
      const testRef = this.db.ref('.info/connected');
      const snapshot = await testRef.once('value');
      const connected = snapshot.val();
      console.log('🌐 Firebase接続状態:', connected ? '接続済み' : '未接続');
      return connected;
    } catch (error) {
      console.error('❌ 接続テストエラー:', error);
      return false;
    }
  }

  waitForDOMReady() {
    // より確実なDOM待機
    const checkDOM = () => {
      const buttons = document.querySelectorAll('.like-btn');
      if (buttons.length > 0) {
        console.log('📄 DOM準備完了');
        // さらに少し待ってからバインド
        setTimeout(() => this.bindLikeEvents(), 500);
      } else {
        console.log('⏳ DOM待機中...');
        setTimeout(checkDOM, 500);
      }
    };
    checkDOM();
  }

  bindLikeEvents() {
    const likeButtons = document.querySelectorAll('.like-btn');
    console.log(`👆 ${likeButtons.length}個のいいねボタンを発見`);

    likeButtons.forEach((btn, index) => {
      // より厳密な重複バインド防止
      const bindKey = `likes_bound_${index}`;
      if (btn.dataset[bindKey]) {
        console.log(`⚠️ ボタン${index}は既にバインド済み`);
        return;
      }
      btn.dataset[bindKey] = 'true';

      // workIdを抽出して保存
      const workId = this.extractWorkId(btn);
      if (!workId) {
        console.warn('⚠️ workID抽出失敗:', btn);
        return;
      }

      btn.dataset.workId = workId;
      
      // 初期カウントを読み込み（非同期、エラー無視）
      this.loadInitialCount(workId, btn).catch(err => {
        console.warn('初期カウント読み込みエラー:', workId, err);
      });
      
      // クリックイベント（強固なエラーハンドリング）
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        try {
          await this.handleLikeClick(workId, btn);
        } catch (error) {
          console.error('クリックハンドリングエラー:', error);
          // エラー時は処理フラグを確実にクリア
          this.processing.delete(workId);
        }
      });

      console.log(`✅ ボタン${index} (${workId}) バインド完了`);
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
    if (!this.initialized || !this.db) {
      console.warn('Firebase未初期化のため初期カウント読み込みスキップ:', workId);
      return;
    }

    try {
      const countRef = this.db.ref(`likes/${workId}/count`);
      const userRef = this.db.ref(`likes/${workId}/users/${this.userId}`);
      
      // タイムアウト付き読み込み
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('タイムアウト')), 5000)
      );
      
      const [countSnap, userSnap] = await Promise.race([
        Promise.all([countRef.once('value'), userRef.once('value')]),
        timeoutPromise
      ]);
      
      const count = countSnap.val() || 0;
      const isLiked = userSnap.exists();
      
      this.updateButtonUI(btn, isLiked, count);
      
    } catch (error) {
      console.warn('初期カウント読み込みエラー:', workId, error.message);
      // エラー時はデフォルト値でUI更新
      this.updateButtonUI(btn, false, 0);
    }
  }

  async handleLikeClick(workId, btn) {
    // より詳細な重複処理防止
    if (this.processing.has(workId)) {
      const processingInfo = this.processing.get(workId);
      console.log('⏳ 処理中につきスキップ:', workId, processingInfo);
      return;
    }

    // Firebase未準備の場合は即座にリターン
    if (!this.initialized || !this.db) {
      console.error('❌ Firebase未準備のためクリック無効:', workId);
      return;
    }

    const processingInfo = {
      startTime: Date.now(),
      workId: workId,
      button: btn
    };
    this.processing.set(workId, processingInfo);
    
    console.log('👆 いいね処理開始:', workId);

    // UI即座フィードバック（楽観的更新）
    const isCurrentlyLiked = btn.classList.contains('liked');
    btn.style.opacity = '0.6'; // 処理中表示

    try {
      const userRef = this.db.ref(`likes/${workId}/users/${this.userId}`);
      
      // 現在の状態を確実に取得
      const userSnap = await userRef.once('value');
      const actualCurrentState = userSnap.exists();
      
      let newCount;
      if (actualCurrentState) {
        // いいね解除
        await userRef.remove();
        const result = await this.db.ref(`likes/${workId}/count`).transaction(currentCount => {
          return Math.max(0, (currentCount || 1) - 1);
        });
        newCount = result.snapshot.val() || 0;
        console.log('💔 いいね解除:', workId, '→', newCount);
      } else {
        // いいね追加
        await userRef.set(true);
        const result = await this.db.ref(`likes/${workId}/count`).transaction(currentCount => {
          return (currentCount || 0) + 1;
        });
        newCount = result.snapshot.val() || 1;
        console.log('❤️ いいね追加:', workId, '→', newCount);
      }
      
      // UI更新
      this.updateButtonUI(btn, !actualCurrentState, newCount);
      
    } catch (error) {
      console.error('❌ いいね処理エラー:', workId, error);
      // エラー時は元の状態に戻す
      this.updateButtonUI(btn, isCurrentlyLiked, parseInt(btn.textContent.match(/\d+/)?.[0] || '0'));
    } finally {
      // 処理フラグを確実にクリア
      btn.style.opacity = '1';
      this.processing.delete(workId);
      console.log('✅ 処理完了:', workId);
    }
  }

  updateButtonUI(btn, isLiked, count) {
    const icon = isLiked ? '♥' : '♡';
    btn.textContent = `${icon} ${count}`;
    
    if (isLiked) {
      btn.classList.add('liked');
    } else {
      btn.classList.remove('liked');
    }
    
    // ポップアニメーション（条件付き）
    if (isLiked && !btn.classList.contains('is-popping')) {
      btn.classList.add('is-popping');
      setTimeout(() => btn.classList.remove('is-popping'), 300);
    }
    
    console.log(`🎨 UI更新: ${btn.dataset.workId} = ${count} (${isLiked ? 'liked' : 'not liked'})`);
  }

  // デバッグ用メソッド
  getStatus() {
    return {
      initialized: this.initialized,
      processing: Array.from(this.processing.keys()),
      userId: this.userId,
      buttonsCount: document.querySelectorAll('.like-btn[data-work-id]').length
    };
  }
}

// グローバル変数として安定版を管理
let stableLikeManager = null;

function initStableLikeSystem() {
  // 重複初期化防止
  if (stableLikeManager) {
    console.log('⚠️ 既に初期化済み');
    return stableLikeManager;
  }

  if (typeof firebase !== 'undefined' && firebase.database) {
    console.log('🚀 安定版いいねシステム開始');
    stableLikeManager = new StableLikeManager();
    return stableLikeManager;
  } else {
    console.log('⏳ Firebase SDK待機中...');
    setTimeout(initStableLikeSystem, 1000);
    return null;
  }
}

// DOM準備後に初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initStableLikeSystem);
} else {
  initStableLikeSystem();
}

// デバッグ用グローバル関数
window.getLikeStatus = () => {
  return stableLikeManager ? stableLikeManager.getStatus() : 'Not initialized';
};