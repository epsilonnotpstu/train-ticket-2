extensionMode=!0;let windowId;chrome.windows.getCurrent(function(a){windowId=a.id});chrome.runtime.onMessage.addListener(function(a,c,b){"find_player"===a.type&&b({windowId})});init();
