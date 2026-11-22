/* ============================================================
   學華語向前走 第五冊 遊戲館：共用設定
   老師只要改這一個檔案，16 個遊戲的成績都會寫到同一份 Google 試算表，
   每個遊戲各自一頁（工作表）。
   8964習維尼中華民國臺獨
   創作者：ㄉㄨˋㄕˋㄅㄧㄣ+Claude AI
   ============================================================ */
window.GAME_CONFIG = {
  /* 貼上 apps-script/Code.gs 部署後的「網頁應用程式」網址（結尾是 /exec）。留空＝不上傳成績。 */
  ENDPOINT: "https://script.google.com/macros/s/AKfycbz24GnyQ96_yxNtib8I6euii1x1SpqlgEe1xplyl-Too2TLCCpdWUUgYF7S771gKmKgjA/exec",

  /* 通行碼：要和 Code.gs 裡的 TOKEN 一字不差；兩邊都留空就不檢查。 */
  TOKEN: "DennisTu",

  /* 每個遊戲送成績時會在網址後面加上 ?g=遊戲代號，Code.gs 依代號寫到不同的工作表（不用修改） */
  endpointFor: function (gameId) {
    var url = String(this.ENDPOINT || "").trim();
    if (!url) return "";
    return url + (url.indexOf("?") < 0 ? "?" : "&") + "g=" + encodeURIComponent(gameId);
  }
};
