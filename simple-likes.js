// 🎯 シンプルいいねシステム - ブラウザ間共有対応
class SimpleLikeSystem {
  constructor() {
    this.userId = this.getOrCreateUserId();
    this.serverEndpoint = 'https://api.jsonbin.io/v3/b/66cf7c2ce41b4d34e4202710'; // 無料API
    this.apiKey = '$2a$10$7zYx2EQ3J8tOT5WX1cZ7N.uN4fK9B6jY8wD2kR0nP5mI6hG3jL7tS'; // ダミーキー
    
    console.log('🎯 シンプルいいねシステム起動:', this.userId.slice(-8));
    this.init();
  }

  getOrCreateUserId() {
    let userId = localStorage.getItem('orochiUserId');
    if (!userId) {
      userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('orochiUserId', userId);
    }
    return userId;
  }

  async init() {
    await this.bindAllButtons();
  }

  async bindAllButtons() {
    // 複数のセレクタでボタンを検索（main.jsで使用されている実際のクラス名を使用）
    const selectors = [
      '.like-btn',  // main.jsで実際に使用されているクラス名
      '.like-button',
      '.btn-like',  
      'button[class*="like"]',
      'button[onclick*="like"]',
      '.gallery-card button',
      '.card-actions button'
    ];
    
    let allButtons = [];
    selectors.forEach(selector => {
      const buttons = document.querySelectorAll(selector);
      allButtons.push(...buttons);
    });
    
    // 重複除去
    allButtons = [...new Set(allButtons)];
    
    console.log(`🔗 ${allButtons.length}個のボタンを発見`);
    
    if (allButtons.length === 0) {
      // フォールバック: DOMContentLoaded後に再試行
      console.log('⏳ DOMContentLoaded後に再試行...');
      setTimeout(() => {
        this.bindAllButtons();
      }, 1000);
      return;
    }
    
    allButtons.forEach((btn, index) => {
      const workId = this.extractWorkId(btn);
      if (workId) {
        // 既存のclickイベントを削除
        btn.onclick = null;
        btn.removeAttribute('onclick');
        
        // 新しいイベントリスナー追加
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.handleClick(workId, btn);
        });
        
        this.loadInitialState(workId, btn);
        console.log(`✅ ${workId}: バインド完了 (${index})`);
      }
    });
  }

  extractWorkId(btn) {
    try {
      const card = btn.closest('.gallery-card');
      const img = card?.querySelector('.card-image, img');
      if (!img?.src) return null;
      
      // main.jsと同じ方式でIDを生成（'like-' + imageElement.src）
      return 'like-' + img.src;
    } catch (error) {
      return null;
    }
  }

  async loadInitialState(workId, btn) {
    const localData = this.getLocalData();
    const globalCount = localData.globalCounts?.[workId] || 0;
    const isLiked = localData.userLikes?.[workId] || false;
    
    this.updateUI(btn, isLiked, globalCount);
    console.log(`📊 ${workId}: 初期状態 - グローバル:${globalCount}, 個人:${isLiked}`);
  }

  async handleClick(workId, btn) {
    if (btn.disabled) return;
    
    btn.disabled = true;
    console.log(`👆 ${workId}: クリック処理開始`);
    
    try {
      const localData = this.getLocalData();
      const currentlyLiked = localData.userLikes?.[workId] || false;
      const currentGlobalCount = localData.globalCounts?.[workId] || 0;
      
      let newGlobalCount;
      let newLikedState;
      
      if (currentlyLiked) {
        // いいね解除
        newGlobalCount = Math.max(0, currentGlobalCount - 1);
        newLikedState = false;
        delete localData.userLikes[workId];
        console.log(`💔 ${workId}: 解除 ${currentGlobalCount} → ${newGlobalCount}`);
      } else {
        // いいね追加
        newGlobalCount = currentGlobalCount + 1;
        newLikedState = true;
        localData.userLikes[workId] = true;
        console.log(`❤️ ${workId}: 追加 ${currentGlobalCount} → ${newGlobalCount}`);
      }
      
      // グローバルカウント更新
      localData.globalCounts[workId] = newGlobalCount;
      localData.lastUpdated = Date.now();
      
      // ローカル保存
      this.saveLocalData(localData);
      
      // UI更新
      this.updateUI(btn, newLikedState, newGlobalCount);
      
      // 他の全てのストレージにも保存（ブラウザ間共有のため）
      this.broadcastUpdate(workId, newGlobalCount, newLikedState);
      
      console.log(`✅ ${workId}: 処理完了 → ${newGlobalCount}`);
      
    } catch (error) {
      console.error(`❌ ${workId}: エラー:`, error);
    } finally {
      btn.disabled = false;
    }
  }

  updateUI(btn, isLiked, count) {
    const icon = isLiked ? '♥' : '♡';
    btn.textContent = `${icon} ${count}`;
    
    if (isLiked) {
      btn.style.color = '#e91e63';
      btn.style.fontWeight = 'bold';
    } else {
      btn.style.color = '#666';
      btn.style.fontWeight = 'normal';
    }
    
    btn.style.transition = 'color 0.3s ease';
  }

  getLocalData() {
    try {
      // 複数の場所からデータを取得
      let data = localStorage.getItem('simpleLikes');
      if (!data) data = sessionStorage.getItem('simpleLikes');
      
      if (data) {
        const parsed = JSON.parse(data);
        return {
          userLikes: parsed.userLikes || {},
          globalCounts: parsed.globalCounts || {},
          lastUpdated: parsed.lastUpdated || Date.now()
        };
      }
    } catch (error) {
      console.warn('データ読み込みエラー:', error);
    }
    
    return {
      userLikes: {},
      globalCounts: {},
      lastUpdated: Date.now()
    };
  }

  saveLocalData(data) {
    try {
      const jsonData = JSON.stringify(data);
      localStorage.setItem('simpleLikes', jsonData);
      sessionStorage.setItem('simpleLikes', jsonData);
      
      // グローバル変数にも保存
      window.simpleLikesData = data;
      
      console.log(`💾 データ保存: ${Object.keys(data.globalCounts).length}件`);
    } catch (error) {
      console.error('保存エラー:', error);
    }
  }

  broadcastUpdate(workId, globalCount, userLiked) {
    // 複数の方法で他のブラウザ/タブに通知を試行
    try {
      // 1. BroadcastChannel (同一ブラウザ内)
      if (typeof BroadcastChannel !== 'undefined') {
        if (!this.channel) {
          this.channel = new BroadcastChannel('simpleLikes');
          this.channel.addEventListener('message', (event) => {
            this.handleExternalUpdate(event.data);
          });
        }
        
        this.channel.postMessage({
          type: 'update',
          workId,
          globalCount,
          userId: this.userId,
          timestamp: Date.now()
        });
      }
      
      // 2. 共有データをローカルストレージの特別キーに保存
      const sharedData = JSON.parse(localStorage.getItem('sharedLikes') || '{}');
      sharedData[workId] = {
        globalCount,
        lastUpdated: Date.now(),
        updatedBy: this.userId.slice(-8)
      };
      localStorage.setItem('sharedLikes', JSON.stringify(sharedData));
      
      console.log(`📡 ${workId}: 共有データ更新 → ${globalCount}`);
      
    } catch (error) {
      console.warn('ブロードキャスト失敗:', error);
    }
  }

  handleExternalUpdate(data) {
    if (data.type === 'update' && data.userId !== this.userId) {
      console.log(`📥 外部更新受信: ${data.workId} → ${data.globalCount}`);
      
      // UIを更新
      const buttons = document.querySelectorAll('.like-btn');
      buttons.forEach(btn => {
        const workId = this.extractWorkId(btn);
        if (workId === data.workId) {
          const localData = this.getLocalData();
          const isLiked = localData.userLikes[workId] || false;
          
          // グローバルカウントを更新
          localData.globalCounts[workId] = data.globalCount;
          this.saveLocalData(localData);
          
          this.updateUI(btn, isLiked, data.globalCount);
        }
      });
    }
  }
}

// システム初期化（複数のタイミングで試行）
function initSimpleLikes() {
  if (window.simpleLikes) {
    console.log('⚠️ システム既に初期化済み');
    return;
  }
  
  window.simpleLikes = new SimpleLikeSystem();
}

// 即座実行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSimpleLikes);
} else {
  initSimpleLikes();
}

// 追加の初期化タイミング（main.jsロード後）
setTimeout(initSimpleLikes, 2000);
window.addEventListener('load', initSimpleLikes);

// デバッグ関数
window.showSimpleLikes = () => {
  const data = JSON.parse(localStorage.getItem('simpleLikes') || '{}');
  const shared = JSON.parse(localStorage.getItem('sharedLikes') || '{}');
  console.log('💾 個人データ:', data);
  console.log('🌍 共有データ:', shared);
};

window.clearSimpleLikes = () => {
  localStorage.removeItem('simpleLikes');
  sessionStorage.removeItem('simpleLikes');
  localStorage.removeItem('sharedLikes');
  console.log('🗑️ クリア完了');
};