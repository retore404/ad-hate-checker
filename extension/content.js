// YouTube Ad Time Tracker - Content Script

class AdTracker {
  constructor() {
    this.isAdPlaying = false;
    this.adStartTime = null;
    this.currentAdInfo = null;
    this.checkInterval = null;
    this.init();
  }

  init() {
    console.log('YouTube Ad Time Tracker: Initialized');
    // 動画プレーヤーの読み込みを待つ
    this.waitForPlayer();
  }

  waitForPlayer() {
    const checkPlayer = setInterval(() => {
      const player = document.querySelector('.html5-video-player');
      if (player) {
        clearInterval(checkPlayer);
        console.log('YouTube Ad Time Tracker: Player found');
        this.startMonitoring();
      }
    }, 1000);
  }

  startMonitoring() {
    // 定期的に広告の状態をチェック
    this.checkInterval = setInterval(() => {
      this.checkAdStatus();
    }, 500); // 0.5秒ごとにチェック

    // MutationObserverで DOM の変更を監視
    const observer = new MutationObserver(() => {
      this.checkAdStatus();
    });

    const player = document.querySelector('.html5-video-player');
    if (player) {
      observer.observe(player, {
        attributes: true,
        attributeFilter: ['class'],
        subtree: true
      });
    }
  }

  checkAdStatus() {
    const player = document.querySelector('.html5-video-player');
    if (!player) return;

    // 広告が表示されているかチェック
    const isAdShowing = player.classList.contains('ad-showing') ||
                       player.classList.contains('ad-interrupting');

    // 追加の広告検出方法
    const adContainer = document.querySelector('.video-ads');
    const adModule = document.querySelector('.ytp-ad-player-overlay');
    const skipButton = document.querySelector('.ytp-ad-skip-button, .ytp-skip-ad-button');

    const adDetected = isAdShowing || (adContainer && adContainer.children.length > 0) || adModule || skipButton;

    if (adDetected && !this.isAdPlaying) {
      // 広告開始
      this.onAdStart();
    } else if (!adDetected && this.isAdPlaying) {
      // 広告終了
      this.onAdEnd();
    }
  }

  onAdStart() {
    this.isAdPlaying = true;
    this.adStartTime = Date.now();
    this.currentAdInfo = this.getAdInfo();

    console.log('YouTube Ad Time Tracker: Ad started', this.currentAdInfo);
  }

  onAdEnd() {
    if (!this.adStartTime) return;

    const duration = Date.now() - this.adStartTime;
    const adData = {
      advertiser: this.currentAdInfo.advertiser,
      videoUrl: this.currentAdInfo.videoUrl,
      duration: duration,
      timestamp: this.adStartTime,
      endTime: Date.now()
    };

    console.log('YouTube Ad Time Tracker: Ad ended', adData);

    // データを保存
    this.saveAdData(adData);

    // リセット
    this.isAdPlaying = false;
    this.adStartTime = null;
    this.currentAdInfo = null;
  }

  getAdInfo() {
    let advertiser = '';

    // 広告主の情報を取得（優先順位順に複数のセレクタを試す）
    const selectors = [
      // 広告主リンクのテキスト（最も確実）
      '.ytp-ad-button-text',
      '.ytp-visit-advertiser-link__text',

      // 広告主名を含むボタン・リンク
      '.ytp-ad-visit-advertiser-button',
      'a.ytp-ad-button-link',
      '.ytp-ad-button-icon',

      // 広告情報テキスト
      '.ytp-ad-text',
      '.ytp-ad-simple-ad-badge-text',
      '.ytp-ad-player-overlay-instream-info',
      '.ytp-ad-preview-text',

      // 広告タイトル・説明
      '.ytp-ad-title',
      '.ytp-ad-description',

      // その他の広告関連要素
      '.video-ads .ytp-ad-text',
      '.ytp-ad-overlay-slot .ytp-ad-text',
      'button[aria-label*="広告"]',
      'a[href*="adurl"]',
    ];

    // 各セレクタを順番に試す
    for (const selector of selectors) {
      try {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent.trim();
          // 意味のあるテキストかチェック（空白や「広告」だけでないか）
          if (text && text.length > 0 &&
              !text.match(/^(広告|Ad|Ads|スポンサー|Sponsored?)$/i) &&
              text.length < 100) { // 長すぎるテキストは除外
            advertiser = text;
            console.log(`YouTube Ad Time Tracker: Advertiser found with selector "${selector}": ${advertiser}`);
            break;
          }
        }
      } catch (e) {
        // セレクタエラーは無視して次へ
        continue;
      }
    }

    // 広告主が見つからない場合、DOM全体から広告関連のaria-labelを探す
    if (!advertiser) {
      try {
        const buttonWithAria = document.querySelector('[aria-label*="広告主"], [aria-label*="advertiser"]');
        if (buttonWithAria) {
          const ariaText = buttonWithAria.getAttribute('aria-label');
          if (ariaText) {
            advertiser = ariaText.replace(/広告主[：:]\s*/i, '').replace(/advertiser[：:]\s*/i, '').trim();
          }
        }
      } catch (e) {
        // エラーは無視
      }
    }

    // 現在の動画URL
    const videoUrl = window.location.href;

    return {
      advertiser: advertiser || '不明な広告主',
      videoUrl: videoUrl
    };
  }

  async saveAdData(adData) {
    try {
      // Chrome storage から既存のデータを取得
      const result = await chrome.storage.local.get(['adHistory']);
      const adHistory = result.adHistory || [];

      // 新しい広告データを追加
      adHistory.push(adData);

      // データを保存
      await chrome.storage.local.set({ adHistory: adHistory });

      // 広告ごとの集計データを更新
      await this.updateAdStats(adData);

      console.log('YouTube Ad Time Tracker: Data saved', adData);
    } catch (error) {
      console.error('YouTube Ad Time Tracker: Error saving data', error);
    }
  }

  async updateAdStats(adData) {
    try {
      const result = await chrome.storage.local.get(['adStats']);
      const adStats = result.adStats || {};

      // 広告主をキーとして使用
      const adKey = adData.advertiser;

      if (!adStats[adKey]) {
        adStats[adKey] = {
          advertiser: adData.advertiser,
          totalDuration: 0,
          count: 0,
          firstSeen: adData.timestamp,
          lastSeen: adData.timestamp
        };
      }

      // 統計を更新
      adStats[adKey].totalDuration += adData.duration;
      adStats[adKey].count += 1;
      adStats[adKey].lastSeen = adData.timestamp;

      // 保存
      await chrome.storage.local.set({ adStats: adStats });
    } catch (error) {
      console.error('YouTube Ad Time Tracker: Error updating stats', error);
    }
  }
}

// ページ読み込み時に初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new AdTracker();
  });
} else {
  new AdTracker();
}
