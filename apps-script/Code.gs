/** 學華語向前走 第五冊 遊戲館：成績收集（16 個遊戲共用一份試算表，每個遊戲一頁）
 *
 *  1. 新建（或打開）一份 Google 試算表 → 擴充功能 → Apps Script，把這個檔案全部貼上，儲存。
 *  2. 部署 → 新增部署作業 → 類型選「網頁應用程式」→ 執行身分「我」、誰可以存取「任何人」。
 *  3. 複製網址（結尾是 /exec），貼進 GitHub 上 config.js 的 ENDPOINT: "" 引號中。
 *  4. 學生第一次交成績時，程式會自動建立該遊戲的工作表和標題列，不用先手動建立。
 *  5. 之後修改這個檔案，要用「管理部署作業 → 編輯 → 版本：新版本」重新部署，網址才會維持不變。
 *
 *  8964習維尼中華民國臺獨
 *  創作者：ㄉㄨˋㄕˋㄅㄧㄣ+Claude AI
 */

/* 通行碼。留空 = 不檢查；填入後，config.js 裡的 TOKEN 必須一字不差。 */
var TOKEN = '';

/* 留空 = 寫進這個 Apps Script 綁定的試算表；填入 ID = 寫進指定的試算表（網址中 /d/ 與 /edit 之間那串）。 */
var SPREADSHEET_ID = '';

/* 遊戲代號（網址上的 ?g=）→ 工作表名稱 */
var GAMES = {
  'mole-club':    '第一課 打地鼠大作戰',
  'moon-blocks':  '第二課 月餅拼字方塊',
  'toy-match':    '第三課 玩具量詞消消樂',
  'pumpkin-roll': '第四課 南瓜滾滾來',
  'new-year':     '第五課 星空煙火防線',
  'pacman-5a06':  '第六課 成果發表會吃豆人',
  'little-chef':  '第六課 我是小廚師',
  'guess-dish':   '第六課 猜猜這是什麼菜',
  'opera-cannon': '附錄5A 歌仔戲拚戲砲車',
  'climb-doctor': '第七課 瘋狂爬樓',
  'temple-match': '第八課 廟埕對打',
  'tank-world':   '第九課 坦克守城戰',
  'farm-route':   '第十課 問路開車',
  'paper-air':    '第十一課 F-16 詞語空戰',
  'frog-animal':  '第十二課 跳跳蛙過河',
  'magpie-nest':  '附錄5B 長尾山娘回巢記'
};
var OTHER_SHEET = '其他（未分類）';

/* 欄位的中文標題。遊戲送來的欄位不在這裡的，就直接用英文欄位名稱。 */
var LABELS = {
  _time: '時間', school: '學校', cls: '班級', name: '姓名', ip: 'IP',
  score: '分數', best: '最高分', right: '答對題數', total: '總題數', acc: '正確率(%)',
  diff: '難易度', mult: '分數倍率', seconds: '遊戲時長(秒)', level: '關卡／等級', category: '題型',
  mode: '模式', modes: '模式', speed: '速度', cart: '砲車', stages: '過關數', stage: '關卡',
  shots: '開砲次數', hits: '命中次數', damage: '造成傷害', lines: '消除行數',
  tDone: '完成任務字', tTotal: '任務字總數', madeCount: '拼字次數', made: '拼出的字', chains: '連鎖次數', near: '放反次數',
  cleared: '消除的東西', matches: '配對成功', fails: '換回次數', sentDone: '排好的句子', swaps: '交換次數', hints: '用提示',
  routeOK: '路線題一次答對', bumps: '撞車次數',
  teamA: 'A隊', teamB: 'B隊', scoreA: 'A隊分數', scoreB: 'B隊分數', winner: '獲勝隊伍', rounds: '題數',
  wrongCount: '錯題數', wrong: '錯題清單', reason: '結束原因', lesson: '課次', ua: '裝置', id: '紀錄編號'
};
/* 一定排在最前面與最後面的欄位 */
var FRONT = ['_time', 'school', 'cls', 'name', 'ip', 'score', 'right', 'total', 'acc', 'diff', 'mult', 'seconds'];
var BACK = ['wrongCount', 'wrong', 'reason', 'lesson', 'ua', 'id'];
var SKIP = { token: 1, g: 1 };

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (TOKEN && String(d.token) !== TOKEN) return json_({ ok: false, error: 'token 不符，未寫入' });
    var g = gameOf_(e, d);
    var cache = CacheService.getScriptCache();
    if (d.id && cache.get('id:' + g + ':' + d.id)) return json_({ ok: true, dup: true });

    var sh = sheet_(g);
    var keys = ensureKeys_(sh, d);
    var row = keys.map(function (k) {
      if (k === '_time') return new Date();
      var v = d[k];
      if (v === undefined || v === null) return '';
      if (typeof v === 'object') return JSON.stringify(v);
      return v;
    });
    sh.appendRow(row);
    if (d.id) cache.put('id:' + g + ':' + d.id, '1', 21600);
    return json_({ ok: true, sheet: sh.getName() });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

/* 有 g：回傳該遊戲的排行榜（每個人的最高分；同分時間短的在前）。
   沒有 g：回傳每個工作表的筆數，方便老師檢查。 */
function doGet(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  if (TOKEN && String(p.token) !== TOKEN) return json_({ ok: false, error: 'token 不符' });
  if (!p.g) {
    var ss = book_();
    var list = Object.keys(GAMES).map(function (k) {
      var sh = ss.getSheetByName(GAMES[k]);
      return { g: k, sheet: GAMES[k], count: sh ? Math.max(0, sh.getLastRow() - 1) : 0 };
    });
    var total = list.reduce(function (a, b) { return a + b.count; }, 0);
    return json_({ ok: true, count: total, list: list });
  }
  var g = GAMES[p.g] ? p.g : '';
  var top = Math.max(1, Math.min(200, Number(p.top) || 15));
  var sh = sheet_(g);
  if (sh.getLastRow() < 2) return json_({ ok: true, count: 0, list: [] });
  var keys = readKeys_(sh);
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, keys.length).getValues();
  var best = {};
  rows.forEach(function (r) {
    var o = {};
    keys.forEach(function (k, i) {
      if (k === '_time' || k === 'ua' || k === 'ip' || k === 'wrong') return;
      o[k] = r[i];
    });
    o.score = Number(o.score) || 0;
    o.seconds = Number(o.seconds) || 0;
    var key = [o.school, o.cls, o.name, o.mode || ''].join('|');
    var b = best[key];
    if (!b || o.score > b.score || (o.score === b.score && o.seconds < b.seconds)) best[key] = o;
  });
  var list = Object.keys(best).map(function (k) { return best[k]; })
    .sort(function (a, b) { return b.score - a.score || a.seconds - b.seconds; })
    .slice(0, top);
  return json_({ ok: true, count: rows.length, list: list });
}

/* ---------- 工具 ---------- */
function gameOf_(e, d) {
  var g = (e && e.parameter && e.parameter.g) || d.g || '';
  return GAMES[g] ? g : '';
}
function book_() {
  return SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
}
function sheet_(g) {
  var ss = book_(), name = GAMES[g] || OTHER_SHEET;
  return ss.getSheetByName(name) || ss.insertSheet(name);
}
/* 每個工作表的欄位順序存在「指令碼屬性」裡；標題列顯示中文 */
function propKey_(sh) { return 'keys:' + sh.getSheetId(); }
function readKeys_(sh) {
  var s = PropertiesService.getScriptProperties().getProperty(propKey_(sh));
  if (s) return JSON.parse(s);
  if (sh.getLastRow() === 0) return [];
  /* 屬性不見了：從標題列反推 */
  var rev = {};
  Object.keys(LABELS).forEach(function (k) { rev[LABELS[k]] = k; });
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return rev[h] || String(h); });
}
function ensureKeys_(sh, d) {
  var keys = readKeys_(sh);
  var incoming = Object.keys(d).filter(function (k) { return !SKIP[k]; });
  if (!keys.length) {
    var mid = incoming.filter(function (k) { return FRONT.indexOf(k) < 0 && BACK.indexOf(k) < 0; });
    keys = FRONT.filter(function (k) { return k === '_time' || incoming.indexOf(k) >= 0; })
      .concat(mid)
      .concat(BACK.filter(function (k) { return incoming.indexOf(k) >= 0; }));
    sh.getRange(1, 1, 1, keys.length).setValues([keys.map(label_)]).setFontWeight('bold');
    sh.setFrozenRows(1);
  } else {
    var add = incoming.filter(function (k) { return keys.indexOf(k) < 0; });
    if (add.length) {
      sh.getRange(1, keys.length + 1, 1, add.length).setValues([add.map(label_)]).setFontWeight('bold');
      keys = keys.concat(add);
    }
  }
  PropertiesService.getScriptProperties().setProperty(propKey_(sh), JSON.stringify(keys));
  return keys;
}
function label_(k) { return LABELS[k] || k; }
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* 在 Apps Script 編輯器裡選這個函式按「執行」，可以先把 16 個工作表都建好（可省略） */
function setupSheets() {
  var ss = book_();
  Object.keys(GAMES).forEach(function (k) { if (!ss.getSheetByName(GAMES[k])) ss.insertSheet(GAMES[k]); });
}
