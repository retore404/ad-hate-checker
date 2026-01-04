// YouTube Ad Time Tracker - Popup Script

let currentSortMode = 'time'; // 'time' or 'count'

// ページ読み込み時
document.addEventListener('DOMContentLoaded', async () => {
  await loadAndDisplayData();
  setupEventListeners();
});

// イベントリスナーの設定
function setupEventListeners() {
  document.getElementById('sortByTime').addEventListener('click', () => {
    currentSortMode = 'time';
    updateSortButtons();
    loadAndDisplayData();
  });

  document.getElementById('sortByCount').addEventListener('click', () => {
    currentSortMode = 'count';
    updateSortButtons();
    loadAndDisplayData();
  });

  document.getElementById('clearData').addEventListener('click', async () => {
    if (confirm('すべての広告データを削除しますか?\nこの操作は取り消せません。')) {
      await clearAllData();
      await loadAndDisplayData();
    }
  });
}

// ソートボタンの表示更新
function updateSortButtons() {
  const timeBtn = document.getElementById('sortByTime');
  const countBtn = document.getElementById('sortByCount');

  if (currentSortMode === 'time') {
    timeBtn.classList.add('active');
    countBtn.classList.remove('active');
  } else {
    timeBtn.classList.remove('active');
    countBtn.classList.add('active');
  }
}

// データの読み込みと表示
async function loadAndDisplayData() {
  try {
    const result = await chrome.storage.local.get(['adStats', 'adHistory']);
    const adStats = result.adStats || {};
    const adHistory = result.adHistory || [];

    // 統計情報を表示
    displaySummary(adStats, adHistory);

    // 広告リストを表示
    displayAdList(adStats);
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

// サマリー情報の表示
function displaySummary(adStats, adHistory) {
  // 総広告時間を計算
  let totalDuration = 0;
  let totalViews = 0;
  let adCount = 0;

  for (const key in adStats) {
    totalDuration += adStats[key].totalDuration;
    totalViews += adStats[key].count;
    adCount++;
  }

  // 時間をフォーマット
  const timeStr = formatDuration(totalDuration);

  document.getElementById('totalTime').textContent = timeStr;
  document.getElementById('adCount').textContent = `${adCount}種類`;
  document.getElementById('totalViews').textContent = `${totalViews}回`;
}

// 広告リストの表示
function displayAdList(adStats) {
  const adListElement = document.getElementById('adList');

  // データを配列に変換
  const adArray = Object.values(adStats);

  if (adArray.length === 0) {
    adListElement.innerHTML = `
      <div class="empty-state">
        まだ広告データがありません。<br>
        YouTubeで動画を視聴すると、広告データが記録されます。
      </div>
    `;
    return;
  }

  // ソート
  adArray.sort((a, b) => {
    if (currentSortMode === 'time') {
      return b.totalDuration - a.totalDuration;
    } else {
      return b.count - a.count;
    }
  });

  // HTML生成
  let html = '';
  adArray.forEach(ad => {
    const timeStr = formatDuration(ad.totalDuration);
    const avgTime = formatDuration(ad.totalDuration / ad.count);
    const firstSeenDate = new Date(ad.firstSeen).toLocaleDateString('ja-JP');
    const lastSeenDate = new Date(ad.lastSeen).toLocaleDateString('ja-JP');

    html += `
      <div class="ad-item">
        <div class="ad-header">
          <div class="ad-info">
            <div class="ad-advertiser">${escapeHtml(ad.advertiser)}</div>
            <div class="ad-title">${escapeHtml(ad.title)}</div>
          </div>
          <div class="ad-stats">
            <div class="ad-time">${timeStr}</div>
            <div class="ad-count">${ad.count}回視聴</div>
          </div>
        </div>
        <div class="ad-details">
          <div class="detail-item">
            <span class="detail-label">平均時間:</span>
            <span>${avgTime}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">初回:</span>
            <span>${firstSeenDate}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">1回あたり:</span>
            <span>${avgTime}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">最終:</span>
            <span>${lastSeenDate}</span>
          </div>
        </div>
      </div>
    `;
  });

  adListElement.innerHTML = html;
}

// 時間のフォーマット（ミリ秒から表示用文字列へ）
function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}時間${minutes}分${seconds}秒`;
  } else if (minutes > 0) {
    return `${minutes}分${seconds}秒`;
  } else {
    return `${seconds}秒`;
  }
}

// HTMLエスケープ
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// データの削除
async function clearAllData() {
  try {
    await chrome.storage.local.set({
      adHistory: [],
      adStats: {}
    });
    console.log('All data cleared');
  } catch (error) {
    console.error('Error clearing data:', error);
  }
}
