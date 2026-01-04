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
      ...this.currentAdInfo,
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
    let adTitle = '不明な広告';
    let adUrl = '';
    let advertiser = '';

    // 広告タイトルを取得
    const adTextElement = document.querySelector('.ytp-ad-text');
    if (adTextElement) {
      adTitle = adTextElement.textContent.trim();
    }

    // 広告主の情報を取得
    const adInfoElement = document.querySelector('.ytp-ad-simple-ad-badge-text');
    if (adInfoElement) {
      advertiser = adInfoElement.textContent.trim();
    }

    // 広告のリンクを取得
    const visitAdvertiserButton = document.querySelector('.ytp-ad-visit-advertiser-button');
    if (visitAdvertiserButton) {
      advertiser = visitAdvertiserButton.textContent.trim();
    }

    // 追加の広告情報
    const adPreviewText = document.querySelector('.ytp-ad-preview-text');
    if (adPreviewText) {
      const previewInfo = adPreviewText.textContent.trim();
      if (previewInfo && adTitle === '不明な広告') {
        adTitle = previewInfo;
      }
    }

    // ビデオタイトルから広告情報を取得
    const videoAd = document.querySelector('.ytp-ad-player-overlay-instream-info');
    if (videoAd) {
      const videoAdText = videoAd.textContent.trim();
      if (videoAdText) {
        advertiser = videoAdText;
      }
    }

    // 現在の動画URL
    const videoUrl = window.location.href;

    return {
      title: adTitle,
      advertiser: advertiser || '不明な広告主',
      url: adUrl,
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

      // 広告のキーを生成（広告主 + タイトル）
      const adKey = `${adData.advertiser}::${adData.title}`;

      if (!adStats[adKey]) {
        adStats[adKey] = {
          advertiser: adData.advertiser,
          title: adData.title,
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
