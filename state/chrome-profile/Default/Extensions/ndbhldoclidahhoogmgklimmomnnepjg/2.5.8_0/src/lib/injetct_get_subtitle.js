// inj.js - 这个文件在页面上下文中运行，可以访问页面的原生对象
(function() {
    'use strict';
    console.log("[注入脚本] 开始拦截XMLHttpRequest");
    // 保存原始的XMLHttpRequest.open方法
    const originalOpen = XMLHttpRequest.prototype.open;
    
    XMLHttpRequest.prototype.open = function(method, url) {
        this._url = url;
        this._method = method;
        
        // 检测字幕API请求
        if (this._url.includes("/api/timedtext")) {
            console.log("[字幕拦截] 检测到字幕请求:", url);
            // 通过chrome.runtime.sendMessage发送URL到激活的tab
            console.log(chrome,"chrome");
            window.subtitle_fetch_url=url;
            // 使用window.postMessage向页面发送消息

            document.querySelector("body").setAttribute("subtitle_fetch_url",url);
            window.postMessage({ 
                type: 'subtitle_fetch_url', 
                data: url 
            }, '*');
            
        }
        
        // 调用原始方法
        return originalOpen.apply(this, arguments);
    };
    
    console.log("[注入脚本] XMLHttpRequest拦截设置完成");
})();
