importScripts('/idb.js');
importScripts('/store.js');

self.addEventListener('sync', function(event) {
    event.waitUntil(pruneQueue);
});


//! UpUp Service Worker
//! version : 1.0.0
//! author  : Tal Ater @TalAter
//! license : MIT
//! https://github.com/TalAter/UpUp
var _CACHE_NAME_PREFIX="upup-cache",_calculateHash=function(e){var t,n=0,s=(e=e.toString()).length;if(0===s)return n;for(t=0;t<s;t++)n=(n<<5)-n+e.charCodeAt(t),n|=0;return n};self.addEventListener("message",function(e){"set-settings"===e.data.action&&_parseSettingsAndCache(e.data.settings)}),self.addEventListener("fetch",function(e){e.respondWith(fetch(e.request).catch(function(){return caches.match(e.request).then(function(t){return t||("navigate"===e.request.mode||"GET"===e.request.method&&e.request.headers.get("accept").includes("text/html")?caches.match("sw-offline-content"):void 0)})}))});var _parseSettingsAndCache=function(e){var t=_CACHE_NAME_PREFIX+"-"+(e["cache-version"]?e["cache-version"]+"-":"")+_calculateHash(e.content+e["content-url"]+e.assets);return caches.open(t).then(function(t){return e.assets&&t.addAll(e.assets.map(function(e){return new Request(e,{mode:"no-cors"})})),e["content-url"]?fetch(e["content-url"],{mode:"no-cors"}).then(function(e){return t.put("sw-offline-content",e)}):e.content?t.put("sw-offline-content",_buildResponse(e.content)):t.put("sw-offline-content",_buildResponse("You are offline"))}).then(function(){return caches.keys().then(function(e){return Promise.all(e.map(function(e){if(e.startsWith(_CACHE_NAME_PREFIX)&&t!==e)return caches.delete(e)}))})})},_buildResponse=function(e){return new Response(e,{headers:{"Content-Type":"text/html"}})};
//# sourceMappingURL=upup.sw.min.js.map