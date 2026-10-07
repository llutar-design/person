/* 인물탐험대 오프라인 지원.
   앱 화면과 데이터는 설치할 때 저장하고(새 버전이 있으면 네트워크 우선),
   그림은 처음 볼 때 저장해 두었다가 다음부터 저장본을 쓴다. */
var VERSION = 'inmul-v2';
var SHELL = [
  './', 'index.html', 'css/style.css', 'js/app.js',
  'data/people-korea.js', 'data/people-world.js', 'manifest.webmanifest',
  'images/favicon.png', 'images/ui/logo.png', 'images/ui/icon-192.png',
  'images/ui/mascot-default.png', 'images/ui/mascot-think.png', 'images/ui/mascot-cheer.png', 'images/ui/mascot-stamp.png',
  'images/ui/start-korea.webp', 'images/ui/start-world.webp', 'images/ui/empty-notebook.webp', 'images/ui/preparing.webp'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  var isImage = /\/images\//.test(req.url);
  if (isImage) {
    // 그림: 저장본 우선
    e.respondWith(caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
        return res;
      });
    }));
  } else {
    // 화면·데이터: 네트워크 우선, 끊기면 저장본
    e.respondWith(fetch(req).then(function (res) {
      if (res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () { return caches.match(req, { ignoreSearch: true }); }));
  }
});
