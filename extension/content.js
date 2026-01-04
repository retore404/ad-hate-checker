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

  async onAdStart() {
    this.isAdPlaying = true;
    this.adStartTime = Date.now();

    // 広告主情報の取得を少し遅延させる（DOMの読み込みを待つ）
    // 複数回リトライして確実に取得
    this.currentAdInfo = await this.getAdInfoWithRetry();

    console.log('YouTube Ad Time Tracker: Ad started', this.currentAdInfo);
  }

  async getAdInfoWithRetry(maxRetries = 5, delayMs = 300) {
    for (let i = 0; i < maxRetries; i++) {
      // 少し待つ（広告主情報のDOMロードを待つ）
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      const info = this.getAdInfo();

      // 広告主が見つかった場合は即座に返す
      if (info.advertiser !== '不明な広告主') {
        console.log(`YouTube Ad Time Tracker: Advertiser found on attempt ${i + 1}`);
        return info;
      }

      console.log(`YouTube Ad Time Tracker: Attempt ${i + 1}/${maxRetries} - advertiser not found yet`);
    }

    // 全てのリトライが失敗した場合、DOM全体をログ出力
    console.log('YouTube Ad Time Tracker: Failed to find advertiser after all retries');
    this.debugAdElements();

    return this.getAdInfo();
  }

  debugAdElements() {
    console.log('=== DEBUG: All ad-related elements ===');

    // 広告関連の全要素を探す
    const adRelatedSelectors = [
      '.ytp-ad-button-text',
      '.ytp-visit-advertiser-link__text',
      '.ytp-ad-visit-advertiser-button',
      '.ytp-ad-text',
      '.ytp-ad-module',
      '.video-ads',
      '[class*="ad"]',
    ];

    adRelatedSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        console.log(`Found ${elements.length} elements for selector: ${selector}`);
        elements.forEach((el, idx) => {
          if (idx < 3) { // 最初の3つだけ表示
            console.log(`  [${idx}] text: "${el.textContent.trim().substring(0, 50)}"`, el);
          }
        });
      }
    });
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
    if (this.currentAdInfo.foundSelector) {
      console.log(`YouTube Ad Time Tracker: Advertiser was found using: ${this.currentAdInfo.foundSelector}`);
    }

    // データを保存
    this.saveAdData(adData);

    // リセット
    this.isAdPlaying = false;
    this.adStartTime = null;
    this.currentAdInfo = null;
  }

  getAdInfo() {
    let advertiser = '';
    let foundSelector = null;

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
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          // 複数の要素がある場合は全てチェック
          for (const element of elements) {
            const text = element.textContent.trim();
            console.log(`YouTube Ad Time Tracker: Checking selector "${selector}" - text: "${text.substring(0, 50)}"`);

            // 意味のあるテキストかチェック（空白や「広告」だけでないか）
            if (text && text.length > 0 &&
                !text.match(/^(広告|Ad|Ads|スポンサー|Sponsored?)$/i) &&
                !text.match(/^\d+\s*(秒|seconds?|sec)/) && // 秒数表示は除外
                text.length < 100) { // 長すぎるテキストは除外
              advertiser = text;
              foundSelector = selector;
              console.log(`YouTube Ad Time Tracker: ✓ Advertiser found with selector "${selector}": ${advertiser}`);
              break;
            }
          }
          if (advertiser) break;
        }
      } catch (e) {
        console.log(`YouTube Ad Time Tracker: Error with selector "${selector}":`, e);
        continue;
      }
    }

    // 広告主が見つからない場合、DOM全体から広告関連のaria-labelを探す
    if (!advertiser) {
      try {
        const buttonWithAria = document.querySelector('[aria-label*="広告主"], [aria-label*="advertiser"]');
        if (buttonWithAria) {
          const ariaText = buttonWithAria.getAttribute('aria-label');
          console.log(`YouTube Ad Time Tracker: Checking aria-label: "${ariaText}"`);
          if (ariaText) {
            advertiser = ariaText.replace(/広告主[：:]\s*/i, '').replace(/advertiser[：:]\s*/i, '').trim();
            foundSelector = 'aria-label';
          }
        }
      } catch (e) {
        console.log('YouTube Ad Time Tracker: Error checking aria-label:', e);
      }
    }

    // 現在の動画URL
    const videoUrl = window.location.href;

    const result = {
      advertiser: advertiser || '不明な広告主',
      videoUrl: videoUrl,
      foundSelector: foundSelector
    };

    if (!advertiser) {
      console.log('YouTube Ad Time Tracker: ⚠ No advertiser found');
    }

    return result;
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
