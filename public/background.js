// 监听插件图标点击事件
chrome.action.onClicked.addListener((tab) => {
  // 在新标签页中打开 index.html
  chrome.tabs.create({
    url: "index.html"
  });
});