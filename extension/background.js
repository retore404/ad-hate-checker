// YouTube Ad Time Tracker - Background Service Worker

// インストール時の処理
chrome.runtime.onInstalled.addListener((details) => {
  console.log('YouTube Ad Time Tracker: Extension installed/updated', details.reason);

  if (details.reason === 'install') {
    // 初回インストール時の初期化
    chrome.storage.local.set({
      adHistory: [],
      adStats: {}
    });
  }
});

// メッセージリスナー（将来的な拡張用）
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getAdStats') {
    chrome.storage.local.get(['adStats', 'adHistory'], (result) => {
      sendResponse({
        stats: result.adStats || {},
        history: result.adHistory || []
      });
    });
    return true; // 非同期レスポンスを許可
  }

  if (request.action === 'clearData') {
    chrome.storage.local.set({
      adHistory: [],
      adStats: {}
    }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

console.log('YouTube Ad Time Tracker: Background service worker loaded');
