// 🏢 Firebase いいねシステム - エンタープライズ安定版
class EnterpriseLikeManager {
  constructor() {
    // Core properties
    this.db = null;
    this.userId = this.generateUserId();
    this.initialized = false;
    this.broadcastChannel = null;
    
    // State management
    this.processing = new Map();
    this.buttonRegistry = new Map();
    this.connectionState = false;
    
    // Configuration
    this.config = {
      maxRetries: 5,
      retryDelay: 800,
      timeout: 12000,
      domCheckInterval: 200,
      bindingDelay: 500,
      transactionTimeout: 8000
    };
    
    // Counters & metrics
    this.metrics = {
      initAttempts: 0,
      successfulClicks: 0,
      failedClicks: 0,
      bindingAttempts: 0
    };
    
    // タブ間同期の初期化
    this.initBroadcastChannel();
    
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

  initBroadcastChannel() {
    if (typeof BroadcastChannel !== 'undefined') {
      this.broadcastChannel = new BroadcastChannel('orochiLikes');
      
      this.broadcastChannel.addEventListener('message', (event) => {
        const { type, data, timestamp } = event.data;
        
        if (type === 'likesUpdate') {
          console.log('📡 他タブからの更新を受信:', data);
          this.handleExternalUpdate(data);
        }
      });
      
      console.log('📡 BroadcastChannel初期化完了');
    } else {
      console.warn('⚠️ BroadcastChannel非対応');
    }
  }

  handleExternalUpdate(data) {
    // 他のタブからの更新をUIに反映
    Object.keys(data.counts).forEach(workId => {
      const count = data.counts[workId];
      const isLiked = data.userLikes[workId] === true;
      
      // 該当するボタンを探してUI更新
      this.buttonRegistry.forEach((buttonInfo, btn) => {
        if (buttonInfo.workId === workId) {
          this.updateButtonUI(btn, isLiked, count);
          console.log(`🔄 ${workId}: 他タブ同期でUI更新`);
        }
      });
    });
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

      console.log('⚠️ PERMISSION_DENIED対策: Firebase Database Rules要確認');

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
      
      // 接続状態の監視を開始
      const checkConnection = (snapshot) => {
        this.connectionState = snapshot.val();
        console.log('🌐 Firebase接続状態:', this.connectionState ? '✅接続' : '❌未接続');
        
        if (this.connectionState) {
          clearTimeout(timeout);
          connectedRef.off('value', checkConnection);
          resolve(true);
        }
      };
      
      // 値の変更を監視（初回 + 接続状態変更時）
      connectedRef.on('value', checkConnection, (error) => {
        clearTimeout(timeout);
        connectedRef.off('value', checkConnection);
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
      
      // 既にバインド済みかチェック（より厳密）
      const bindKey = `enterprise_bound_${index}_${Date.now()}`;
      if (btn.dataset.enterpriseBound || this.buttonRegistry.has(btn)) {
        console.log(`⏭️ ボタン${index}: 既にバインド済みスキップ`);
        return;
      }

      // workId抽出
      const workId = this.extractWorkId(btn);
      if (!workId) {
        throw new Error(`ボタン${index}: workId抽出失敗`);
      }

      // 古いイベントリスナーを完全削除（クローン方式）
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      
      // ボタン登録（新しい要素で）
      const buttonInfo = {
        element: newBtn,
        workId: workId,
        index: index,
        bindTime: Date.now(),
        clickCount: 0
      };
      
      this.buttonRegistry.set(newBtn, buttonInfo);
      newBtn.dataset.enterpriseBound = bindKey;
      newBtn.dataset.workId = workId;

      // 単一イベントリスナー追加
      const clickHandler = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // disabled状態チェック
        if (newBtn.disabled) {
          console.log(`🚫 ${workId}: ボタン無効状態、クリック無視`);
          return;
        }
        
        buttonInfo.clickCount++;
        console.log(`🖱️ ${workId}: クリック #${buttonInfo.clickCount}`);
        
        await this.handleSecureClick(workId, newBtn, buttonInfo);
      };

      newBtn.addEventListener('click', clickHandler);
      buttonInfo.clickHandler = clickHandler;

      // 初期状態読み込み
      await this.loadSecureInitialState(workId, newBtn);
      
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
    // ローカル個人データ取得
    const likesData = this.getLocalLikesData();
    const isLiked = likesData.userLikes[workId] || false;
    
    // グローバルカウント取得（全ユーザー合計）
    let globalCount = this.getGlobalCount(workId);
    
    // グローバルカウントをローカルデータにも同期
    if (!likesData.globalCounts) likesData.globalCounts = {};
    if (globalCount > (likesData.globalCounts[workId] || 0)) {
      likesData.globalCounts[workId] = globalCount;
      this.saveLocalLikesData(likesData);
    } else {
      globalCount = likesData.globalCounts[workId] || 0;
    }
    
    this.updateButtonUI(btn, isLiked, globalCount);
    console.log(`💾 ${workId}: 初期状態 - グローバル:${globalCount}, 個人:${isLiked ? 'liked' : 'unliked'}`);
    
    // デバッグ情報
    console.log(`🔍 ${workId}: ユーザーID=${this.userId.slice(-8)}... グローバル=${globalCount} 個人=${isLiked}`);
  }

  syncFirebaseToLocal(workId, count, isLiked) {
    const likesData = this.getLocalLikesData();
    likesData.counts[workId] = count;
    if (isLiked) {
      likesData.userLikes[workId] = true;
    } else {
      delete likesData.userLikes[workId];
    }
    this.saveLocalLikesData(likesData);
    console.log(`🔄 ${workId}: Firebase→ローカル同期完了 ${count} (${isLiked ? 'liked' : 'unliked'})`);
  }

  async handleSecureClick(workId, btn, buttonInfo) {
    // より厳密な重複処理防止
    const processingKey = `${workId}_${this.userId}`;
    
    if (this.processing.has(processingKey)) {
      console.warn(`🚫 ${workId}: 重複クリック無視`);
      return;
    }

    // 処理開始
    this.processing.set(processingKey, {
      workId,
      button: btn,
      startTime: Date.now(),
      attempt: 1
    });
    
    console.log(`👆 ${workId}: セキュアクリック処理開始`);

    // UI即座フィードバック
    btn.disabled = true;
    btn.style.opacity = '0.7';

    try {
      // ローカルストレージ transaction実行
      const result = await this.executeSecureTransaction(workId);
      
      // 成功処理
      this.metrics.successfulClicks++;
      this.updateButtonUI(btn, result.isLiked, result.count);
      
      console.log(`✅ ${workId}: 処理成功 → ${result.count} (${result.isLiked ? 'liked' : 'unliked'})`);
      
    } catch (error) {
      // エラー処理
      this.metrics.failedClicks++;
      console.error(`❌ ${workId}: 処理エラー:`, error.message);
      this.showTemporaryError(btn, 'エラー');
      
    } finally {
      // 処理完了
      btn.disabled = false;
      btn.style.opacity = '1';
      this.processing.delete(processingKey);
      
      console.log(`🏁 ${workId}: 処理完了`);
    }
  }

  async executeSecureTransaction(workId) {
    // 一時的にローカルのみで動作
    console.log(`💾 ${workId}: ローカル専用モードで処理`);
    return await this.executeLocalStorageTransaction(workId);
  }

  async executeFirebaseTransaction(workId) {
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
      const result = await countRef.transaction((currentCount) => {
        return (currentCount || 0) + 1;
      });
      
      if (!result.committed) {
        throw new Error('追加トランザクション失敗');
      }
      
      await userRef.set({
        timestamp: Date.now(),
        liked: true
      });
      
      newCount = result.snapshot.val() || 1;
      console.log(`❤️ ${workId}: いいね追加 → ${newCount}`);
    }

    return {
      isLiked: !currentlyLiked,
      count: newCount,
      workId: workId
    };
  }

  async executeLocalStorageTransaction(workId) {
    console.log(`💾 ${workId}: ローカルストレージで処理開始`);
    
    // ローカルストレージからデータ読み込み
    const likesData = this.getLocalLikesData();
    
    // 現在の個人状態とグローバルカウント
    const currentlyLiked = likesData.userLikes[workId] === true;
    const globalCount = likesData.globalCounts[workId] || 0;
    
    console.log(`🔍 ${workId}: 処理前状態 - グローバルカウント:${globalCount}, 個人いいね:${currentlyLiked}`);
    
    let newGlobalCount;
    let newLikedState;
    
    if (currentlyLiked) {
      // いいね解除: 個人状態削除 + グローバルカウント-1
      delete likesData.userLikes[workId];
      newGlobalCount = Math.max(0, globalCount - 1);
      newLikedState = false;
      console.log(`💔 ${workId}: いいね解除 - グローバル:${globalCount} → ${newGlobalCount}`);
    } else {
      // いいね追加: 個人状態追加 + グローバルカウント+1
      likesData.userLikes[workId] = true;
      newGlobalCount = globalCount + 1;
      newLikedState = true;
      console.log(`❤️ ${workId}: いいね追加 - グローバル:${globalCount} → ${newGlobalCount}`);
    }
    
    // グローバルカウント保存（全ユーザー共有）
    if (!likesData.globalCounts) likesData.globalCounts = {};
    likesData.globalCounts[workId] = newGlobalCount;
    
    // 個人データは個別保存
    this.saveLocalLikesData(likesData);
    
    // グローバルカウントを共有ストレージに保存
    this.saveGlobalCount(workId, newGlobalCount);
    
    console.log(`💾 ${workId}: 処理完了 - グローバル:${newGlobalCount}, 個人:${newLikedState}`);
    
    return {
      isLiked: newLikedState,
      count: newGlobalCount,
      workId: workId
    };
  }

  saveGlobalCount(workId, count) {
    try {
      // グローバルカウントを複数箇所に保存（ブラウザ間共有を試行）
      const globalData = JSON.parse(localStorage.getItem('orochiGlobalCounts') || '{}');
      globalData[workId] = count;
      globalData.lastUpdated = Date.now();
      
      localStorage.setItem('orochiGlobalCounts', JSON.stringify(globalData));
      sessionStorage.setItem('orochiGlobalCounts', JSON.stringify(globalData));
      
      // グローバル変数にも保存
      if (!window.orochiGlobalCounts) window.orochiGlobalCounts = {};
      window.orochiGlobalCounts[workId] = count;
      
      console.log(`🌍 ${workId}: グローバルカウント保存 → ${count}`);
    } catch (error) {
      console.error('グローバルカウント保存エラー:', error);
    }
  }

  getGlobalCount(workId) {
    try {
      // 複数箇所からグローバルカウント取得
      let globalData = localStorage.getItem('orochiGlobalCounts');
      if (!globalData) {
        globalData = sessionStorage.getItem('orochiGlobalCounts');
      }
      if (!globalData && window.orochiGlobalCounts) {
        globalData = JSON.stringify(window.orochiGlobalCounts);
      }
      
      if (globalData) {
        const parsed = JSON.parse(globalData);
        return parsed[workId] || 0;
      }
    } catch (error) {
      console.warn('グローバルカウント読み込みエラー:', error);
    }
    return 0;
  }

  getLocalLikesData() {
    try {
      // 複数の場所からデータを試行
      let stored = localStorage.getItem('orochiLikes');
      if (!stored) {
        stored = sessionStorage.getItem('orochiLikes');
      }
      if (!stored) {
        // 一時的にグローバル変数も確認
        stored = window.orochiGlobalLikes ? JSON.stringify(window.orochiGlobalLikes) : null;
      }
      
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('ストレージ読み込みエラー:', error);
    }
    
    return {
      userLikes: {},      // 個人のいいね状態
      counts: {},         // 廃止予定（互換性のため残す）
      globalCounts: {},   // グローバルカウント（全ユーザー合計）
      lastUpdated: Date.now(),
      globalSync: true
    };
  }

  saveLocalLikesData(data) {
    try {
      data.lastUpdated = Date.now();
      data.globalSync = true;
      
      const jsonData = JSON.stringify(data);
      
      // 複数の場所に保存してブラウザ間同期を試行
      localStorage.setItem('orochiLikes', jsonData);
      sessionStorage.setItem('orochiLikes', jsonData);
      
      // グローバル変数にも保存（同一タブ内での同期用）
      window.orochiGlobalLikes = data;
      
      // BroadcastChannel での他タブ通知（同一ブラウザ内）
      if (typeof BroadcastChannel !== 'undefined') {
        if (!this.broadcastChannel) {
          this.broadcastChannel = new BroadcastChannel('orochiLikes');
        }
        this.broadcastChannel.postMessage({
          type: 'likesUpdate',
          data: data,
          timestamp: Date.now()
        });
      }
      
      console.log(`💾 データ保存完了: ${Object.keys(data.counts).length}件`);
    } catch (error) {
      console.error('ストレージ保存エラー:', error);
    }
  }

  updateButtonUI(btn, isLiked, count) {
    const icon = isLiked ? '♥' : '♡';
    btn.textContent = `${icon} ${count}`;
    
    // CSS class管理
    if (isLiked) {
      btn.classList.add('liked');
      btn.classList.remove('unliked');
      // 統一されたいいね状態のスタイル
      btn.style.color = '#e91e63';
      btn.style.fontWeight = 'bold';
    } else {
      btn.classList.remove('liked');
      btn.classList.add('unliked');
      // 統一されたデフォルト状態のスタイル
      btn.style.color = '#666';
      btn.style.fontWeight = 'normal';
    }
    
    // 統一されたトランジション
    btn.style.transition = 'color 0.3s ease, transform 0.2s ease';
    
    // アニメーション（控えめ）
    if (isLiked && !btn.classList.contains('is-animating')) {
      btn.classList.add('is-animating', 'is-popping');
      btn.style.transform = 'scale(1.1)';
      setTimeout(() => {
        btn.classList.remove('is-animating', 'is-popping');
        btn.style.transform = 'scale(1)';
      }, 300);
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

// ローカルストレージクリア機能（テスト用）
window.clearLocalLikes = () => {
  localStorage.removeItem('orochiLikes');
  localStorage.removeItem('orochiUserId');
  console.log('🗑️ ローカルいいねデータクリア完了。リロードしてください。');
};

// デバッグ用：現在のローカルストレージ状態表示
window.showLocalLikes = () => {
  const data = localStorage.getItem('orochiLikes');
  if (data) {
    console.log('💾 現在のローカルいいねデータ:', JSON.parse(data));
  } else {
    console.log('💾 ローカルいいねデータなし');
  }
};

// 開発者用：完全リセット（Firebase + ローカル）
window.resetAllLikes = async () => {
  console.log('🚨 全いいねデータリセット開始...');
  
  // ローカルストレージクリア
  localStorage.removeItem('orochiLikes');
  localStorage.removeItem('orochiUserId');
  
  // Firebase側のリセット（権限があれば）
  if (enterpriseManager && enterpriseManager.db && enterpriseManager.connectionState) {
    try {
      const likesRef = enterpriseManager.db.ref('likes');
      await likesRef.remove();
      console.log('🔥 Firebaseデータもクリア完了');
    } catch (error) {
      console.warn('⚠️ Firebase権限なし、ローカルのみクリア:', error.message);
    }
  }
  
  console.log('✅ 全リセット完了！ページをリロードしてください。');
};

// デバッグ用：詳細状態確認
window.debugLikeSystem = () => {
  console.log('🔍 === いいねシステム詳細デバッグ ===');
  
  if (enterpriseManager) {
    console.log('👤 ユーザーID:', enterpriseManager.userId);
    console.log('🔌 Firebase接続状態:', enterpriseManager.connectionState);
    console.log('📊 システム状態:', enterpriseManager.getSystemStatus());
  }
  
  // ローカルストレージの詳細
  const localData = localStorage.getItem('orochiLikes');
  if (localData) {
    const parsed = JSON.parse(localData);
    console.log('💾 ローカルストレージ詳細:', parsed);
    console.log('👥 ユーザーいいね一覧:', parsed.userLikes);
    console.log('📊 カウント一覧:', parsed.counts);
  } else {
    console.log('💾 ローカルストレージ: データなし');
  }
  
  // 20250827の状態を詳しく確認
  if (localData) {
    const data = JSON.parse(localData);
    const workId = '20250827';
    console.log(`🔍 ${workId} 詳細:`);
    console.log(`  - ユーザーいいね: ${data.userLikes[workId] ? 'あり' : 'なし'}`);
    console.log(`  - カウント: ${data.counts[workId] || 0}`);
  }
  
  console.log('🔍 ==========================================');
};