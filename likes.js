// 🏢 Firebase いいねシステム - エンタープライズ安定版
class EnterpriseLikeManager {
  constructor() {
    // Core properties
    this.db = null;
    this.userId = this.generateUserId();
    this.initialized = false;
    
    // State management
    this.processing = new Map();
    this.buttonRegistry = new Map();
    this.connectionState = false;
    
    // Configuration
    this.config = {
      maxRetries: 5,
      retryDelay: 1000,
      timeout: 8000,
      domCheckInterval: 300,
      bindingDelay: 800,
      transactionTimeout: 10000
    };
    
    // Counters & metrics
    this.metrics = {
      initAttempts: 0,
      successfulClicks: 0,
      failedClicks: 0,
      bindingAttempts: 0
    };
    
    console.log('🏢 エンタープライズいいねシステム起動');
    this.initializeSystem();
  }

  generateUserId() {
    let userId = localStorage.getItem('orochiUserId');
    if (!userId) {
      userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
      localStorage.setItem('orochiUserId', userId);
      console.log('👤 新規ユーザーID生成:', userId);
    } else {
      console.log('👤 既存ユーザーID読み込み:', userId);
    }
    return userId;
  }

  async initializeSystem() {
    this.metrics.initAttempts++;
    
    if (this.initialized) {
      console.log('⚠️ システム既に初期化済み');
      return;
    }

    try {
      console.log(`🚀 システム初期化開始 (試行${this.metrics.initAttempts})`);
      
      // Firebase初期化
      await this.initFirebase();
      
      // 接続状態監視開始
      this.startConnectionMonitoring();
      
      // DOM準備完了まで待機
      await this.waitForDOMReady();
      
      // イベントバインド実行
      await this.bindAllEvents();
      
      this.initialized = true;
      console.log('✅ システム初期化完了');
      
    } catch (error) {
      console.error('❌ システム初期化エラー:', error);
      await this.handleInitializationError(error);
    }
  }

  async initFirebase() {
    try {
      const firebaseConfig = {
        apiKey: "AIzaSyDgGLO59I3GxWxhvavAKTY1vk5kLWsSH-k",
        authDomain: "orochi-shrine-likes.firebaseapp.com",
        databaseURL: "https://orochi-shrine-likes-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "orochi-shrine-likes",
        storageBucket: "orochi-shrine-likes.firebasestorage.app",
        messagingSenderId: "459406898781",
        appId: "1:459406898781:web:714a214abc0782a577ffb4"
      };

      // Firebase app初期化（重複回避）
      let app;
      try {
        app = firebase.app(); // 既存のappを取得
        console.log('🔥 既存Firebaseアプリ使用');
      } catch (e) {
        app = firebase.initializeApp(firebaseConfig);
        console.log('🔥 新規Firebaseアプリ初期化');
      }
      
      this.db = firebase.database();
      
      // 接続テスト
      await this.testFirebaseConnection();
      
    } catch (error) {
      throw new Error(`Firebase初期化失敗: ${error.message}`);
    }
  }

  async testFirebaseConnection() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Firebase接続テストタイムアウト'));
      }, this.config.timeout);

      const connectedRef = this.db.ref('.info/connected');
      connectedRef.once('value', (snapshot) => {
        clearTimeout(timeout);
        this.connectionState = snapshot.val();
        console.log('🌐 Firebase接続状態:', this.connectionState ? '✅接続' : '❌未接続');
        
        if (this.connectionState) {
          resolve(true);
        } else {
          reject(new Error('Firebase未接続'));
        }
      }, (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  startConnectionMonitoring() {
    if (!this.db) return;
    
    const connectedRef = this.db.ref('.info/connected');
    connectedRef.on('value', (snapshot) => {
      const connected = snapshot.val();
      if (connected !== this.connectionState) {
        this.connectionState = connected;
        console.log('🔄 接続状態変更:', connected ? '復旧' : '切断');
        
        if (connected) {
          // 再接続時の処理
          this.onReconnection();
        }
      }
    });
  }

  onReconnection() {
    console.log('🔄 再接続処理開始');
    // 処理中のタスクをクリア
    this.processing.clear();
    // UI状態を再同期
    this.resyncAllButtons();
  }

  async waitForDOMReady() {
    return new Promise((resolve) => {
      const checkDOM = () => {
        const buttons = document.querySelectorAll('.like-btn');
        if (buttons.length > 0) {
          console.log(`📄 DOM準備完了 (${buttons.length}個のボタン発見)`);
          resolve();
        } else {
          console.log('⏳ DOM要素待機中...');
          setTimeout(checkDOM, this.config.domCheckInterval);
        }
      };
      checkDOM();
    });
  }

  async bindAllEvents() {
    await new Promise(resolve => setTimeout(resolve, this.config.bindingDelay));
    
    const likeButtons = document.querySelectorAll('.like-btn');
    console.log(`🔗 イベントバインド開始 (${likeButtons.length}個)`);
    
    const bindPromises = Array.from(likeButtons).map((btn, index) => 
      this.bindSingleButton(btn, index)
    );
    
    const results = await Promise.allSettled(bindPromises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log(`✅ バインド結果: 成功${successful}個, 失敗${failed}個`);
    
    if (failed > 0) {
      console.warn('⚠️ 一部ボタンのバインドに失敗');
    }
  }

  async bindSingleButton(btn, index) {
    try {
      this.metrics.bindingAttempts++;
      
      // 既にバインド済みかチェック
      const bindKey = `enterprise_bound_${index}_${Date.now()}`;
      if (this.buttonRegistry.has(btn)) {
        console.log(`⏭️ ボタン${index}: 既にバインド済み`);
        return;
      }

      // workId抽出
      const workId = this.extractWorkId(btn);
      if (!workId) {
        throw new Error(`ボタン${index}: workId抽出失敗`);
      }

      // ボタン登録
      const buttonInfo = {
        element: btn,
        workId: workId,
        index: index,
        bindTime: Date.now(),
        clickCount: 0
      };
      
      this.buttonRegistry.set(btn, buttonInfo);
      btn.dataset.enterpriseBound = bindKey;
      btn.dataset.workId = workId;

      // イベントリスナー追加
      const clickHandler = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        buttonInfo.clickCount++;
        await this.handleSecureClick(workId, btn, buttonInfo);
      };

      btn.addEventListener('click', clickHandler);
      buttonInfo.clickHandler = clickHandler;

      // 初期状態読み込み
      await this.loadSecureInitialState(workId, btn);
      
      console.log(`✅ ボタン${index}(${workId}): バインド完了`);
      
    } catch (error) {
      console.error(`❌ ボタン${index}バインドエラー:`, error.message);
      throw error;
    }
  }

  extractWorkId(btn) {
    try {
      const card = btn.closest('.gallery-card');
      if (!card) return null;
      
      const img = card.querySelector('.card-image, img');
      if (!img || !img.src) return null;
      
      const match = img.src.match(/img_(\d{8})\./);
      return match ? match[1] : null;
    } catch (error) {
      console.error('workId抽出エラー:', error);
      return null;
    }
  }

  async loadSecureInitialState(workId, btn) {
    if (!this.connectionState) {
      console.warn(`🔌 ${workId}: 未接続のため初期状態スキップ`);
      this.updateButtonUI(btn, false, 0);
      return;
    }

    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('初期状態読み込みタイムアウト')), this.config.timeout)
      );

      const dataPromise = Promise.all([
        this.db.ref(`likes/${workId}/count`).once('value'),
        this.db.ref(`likes/${workId}/users/${this.userId}`).once('value')
      ]);

      const [countSnap, userSnap] = await Promise.race([dataPromise, timeoutPromise]);
      
      const count = countSnap.val() || 0;
      const isLiked = userSnap.exists();
      
      this.updateButtonUI(btn, isLiked, count);
      
    } catch (error) {
      console.warn(`⚠️ ${workId}初期状態読み込み失敗:`, error.message);
      this.updateButtonUI(btn, false, 0);
    }
  }

  async handleSecureClick(workId, btn, buttonInfo) {
    // 重複処理チェック（強化版）
    if (this.processing.has(workId)) {
      const processingInfo = this.processing.get(workId);
      const elapsed = Date.now() - processingInfo.startTime;
      
      console.log(`⏳ ${workId}: 処理中 (${elapsed}ms経過)`);
      
      // 長時間処理中の場合は強制クリア
      if (elapsed > this.config.transactionTimeout) {
        console.warn(`🚨 ${workId}: 処理タイムアウトで強制クリア`);
        this.processing.delete(workId);
      } else {
        return;
      }
    }

    // 接続状態チェック
    if (!this.connectionState) {
      console.error(`🔌 ${workId}: Firebase未接続のためクリック無効`);
      this.showTemporaryError(btn, '接続エラー');
      return;
    }

    // 処理開始
    const processingInfo = {
      workId,
      button: btn,
      startTime: Date.now(),
      attempt: 1
    };
    
    this.processing.set(workId, processingInfo);
    console.log(`👆 ${workId}: セキュアクリック処理開始`);

    // UI即座フィードバック
    const currentLiked = btn.classList.contains('liked');
    btn.style.opacity = '0.7';
    btn.style.transform = 'scale(0.95)';

    try {
      // Firebase transaction実行
      const result = await this.executeSecureTransaction(workId);
      
      // 成功処理
      this.metrics.successfulClicks++;
      this.updateButtonUI(btn, result.isLiked, result.count);
      
      console.log(`✅ ${workId}: 処理成功 → ${result.count} (${result.isLiked ? 'liked' : 'unliked'})`);
      
    } catch (error) {
      // エラー処理
      this.metrics.failedClicks++;
      console.error(`❌ ${workId}: 処理エラー:`, error.message);
      
      // UI状態復元
      this.updateButtonUI(btn, currentLiked, this.extractCurrentCount(btn));
      this.showTemporaryError(btn, 'エラー');
      
    } finally {
      // 処理完了
      btn.style.opacity = '1';
      btn.style.transform = 'scale(1)';
      this.processing.delete(workId);
      
      const elapsed = Date.now() - processingInfo.startTime;
      console.log(`🏁 ${workId}: 処理完了 (${elapsed}ms)`);
    }
  }

  async executeSecureTransaction(workId) {
    const userRef = this.db.ref(`likes/${workId}/users/${this.userId}`);
    const countRef = this.db.ref(`likes/${workId}/count`);

    // 現在のユーザー状態を確認
    const userSnap = await userRef.once('value');
    const currentlyLiked = userSnap.exists();

    let newCount;
    if (currentlyLiked) {
      // いいね解除
      await userRef.remove();
      const result = await countRef.transaction((currentCount) => {
        return Math.max(0, (currentCount || 1) - 1);
      });
      
      if (!result.committed) {
        throw new Error('解除トランザクション失敗');
      }
      
      newCount = result.snapshot.val() || 0;
      console.log(`💔 ${workId}: いいね解除 → ${newCount}`);
      
    } else {
      // いいね追加
      await userRef.set(true);
      const result = await countRef.transaction((currentCount) => {
        return (currentCount || 0) + 1;
      });
      
      if (!result.committed) {
        throw new Error('追加トランザクション失敗');
      }
      
      newCount = result.snapshot.val() || 1;
      console.log(`❤️ ${workId}: いいね追加 → ${newCount}`);
    }

    return {
      isLiked: !currentlyLiked,
      count: newCount,
      workId: workId
    };
  }

  updateButtonUI(btn, isLiked, count) {
    const icon = isLiked ? '♥' : '♡';
    btn.textContent = `${icon} ${count}`;
    
    // CSS class管理
    if (isLiked) {
      btn.classList.add('liked');
      btn.classList.remove('unliked');
    } else {
      btn.classList.remove('liked');
      btn.classList.add('unliked');
    }
    
    // アニメーション（控えめ）
    if (isLiked && !btn.classList.contains('is-animating')) {
      btn.classList.add('is-animating', 'is-popping');
      setTimeout(() => {
        btn.classList.remove('is-animating', 'is-popping');
      }, 400);
    }
    
    console.log(`🎨 ${btn.dataset.workId}: UI更新完了 ${count} (${isLiked ? 'liked' : 'unliked'})`);
  }

  showTemporaryError(btn, message) {
    const originalText = btn.textContent;
    btn.textContent = `⚠️ ${message}`;
    btn.style.color = '#ff6b6b';
    
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.color = '';
    }, 2000);
  }

  extractCurrentCount(btn) {
    const match = btn.textContent.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  async resyncAllButtons() {
    console.log('🔄 全ボタン再同期開始');
    
    const promises = Array.from(this.buttonRegistry.entries()).map(([btn, info]) => {
      return this.loadSecureInitialState(info.workId, btn);
    });
    
    await Promise.allSettled(promises);
    console.log('✅ 全ボタン再同期完了');
  }

  async handleInitializationError(error) {
    if (this.metrics.initAttempts <= this.config.maxRetries) {
      const delay = this.config.retryDelay * this.metrics.initAttempts;
      console.log(`🔄 ${delay}ms後に初期化リトライ (${this.metrics.initAttempts}/${this.config.maxRetries})`);
      
      setTimeout(() => {
        this.initializeSystem();
      }, delay);
    } else {
      console.error('💀 初期化最大試行回数に達しました。システム停止。');
    }
  }

  // デバッグ・監視用メソッド
  getSystemStatus() {
    return {
      initialized: this.initialized,
      connectionState: this.connectionState,
      activeProcessing: Array.from(this.processing.keys()),
      buttonsRegistered: this.buttonRegistry.size,
      metrics: { ...this.metrics },
      userId: this.userId
    };
  }

  getProcessingStatus() {
    return Array.from(this.processing.entries()).map(([workId, info]) => ({
      workId,
      elapsed: Date.now() - info.startTime,
      attempt: info.attempt
    }));
  }
}

// グローバル管理
let enterpriseManager = null;

function initEnterpriseLikeSystem() {
  if (enterpriseManager) {
    console.log('⚠️ エンタープライズシステム既に初期化済み');
    return enterpriseManager;
  }

  if (typeof firebase === 'undefined' || !firebase.database) {
    console.log('⏳ Firebase SDK待機中...');
    setTimeout(initEnterpriseLikeSystem, 1000);
    return null;
  }

  console.log('🏢 エンタープライズいいねシステム開始');
  enterpriseManager = new EnterpriseLikeManager();
  return enterpriseManager;
}

// 初期化実行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEnterpriseLikeSystem);
} else {
  initEnterpriseLikeSystem();
}

// デバッグ用グローバル関数
window.getLikeSystemStatus = () => {
  return enterpriseManager ? enterpriseManager.getSystemStatus() : 'Not initialized';
};

window.getProcessingStatus = () => {
  return enterpriseManager ? enterpriseManager.getProcessingStatus() : [];
};

// 緊急リセット機能
window.resetLikeSystem = () => {
  if (enterpriseManager) {
    enterpriseManager.processing.clear();
    enterpriseManager.resyncAllButtons();
    console.log('🔄 システムリセット完了');
  }
};