(function () {
  var key = "wechat-config-token";
  var hash = location.hash.replace(/^#/, "");
  if (hash) {
    try { sessionStorage.setItem(key, hash); } catch (e) {}
    return;
  }
  try { if (sessionStorage.getItem(key)) return; } catch (e) { return; }
  function show() {
    if (!document.body || document.getElementById("draft-token-panel")) return;
    var wrap = document.createElement("div");
    wrap.id = "draft-token-panel";
    wrap.style.cssText = "position:fixed;inset:0;z-index:99999;background:#f4f5f7;display:flex;align-items:center;justify-content:center;font:16px/1.5 ui-sans-serif,system-ui,sans-serif;color:#1c1c1f";
    wrap.innerHTML = '<form style="width:min(420px,92vw);background:#fff;border:1px solid #e4e4e7;border-radius:12px;padding:24px"><h1 style="font-size:18px;margin:0 0 8px">打开云端工作台</h1><p style="margin:0 0 16px;color:#666">插件默认仍在你的电脑上运行。这里是可选的云端页面，需要访问令牌。令牌只留在这个浏览器会话里。</p><input name="token" type="password" autocomplete="current-password" required minlength="32" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #d4d4d8;border-radius:8px" placeholder="访问令牌"><button style="margin-top:12px;padding:8px 14px;border:0;border-radius:8px;background:#111;color:#fff" type="submit">继续</button></form>';
    document.body.appendChild(wrap);
    wrap.querySelector("form").addEventListener("submit", function (event) {
      event.preventDefault();
      var token = wrap.querySelector("input").value.trim();
      try { sessionStorage.setItem(key, token); } catch (e) { return; }
      location.reload();
    });
  }
  if (document.body) show();
  else document.addEventListener("DOMContentLoaded", show);
})();
