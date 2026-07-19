// Helpers for embedding YouTube videos in a locked-down way:
// - youtube-nocookie.com domain (no personalised suggestions/branding)
// - modestbranding + rel=0 + no info overlay
// - IFrame Player API wired up so we get a real "ended" event
//   (this is what lets us auto-move a finished live class into Lectures)

export function extractYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{6,})/,
    /youtube(?:-nocookie)?\.com\/embed\/([a-zA-Z0-9_-]{6,})/,
    /[?&]v=([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

// Builds a self-contained HTML page (loaded via WebView `source={{ html, baseUrl }}`)
// that hosts the YouTube IFrame Player API and forwards player state changes back
// to React Native via window.ReactNativeWebView.postMessage.
export function buildYouTubeEmbedHtml(videoId: string, opts?: { autoplay?: boolean }) {
  const autoplay = opts?.autoplay ? 1 : 0;
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>
    html, body { margin:0; padding:0; background:#000; overflow:hidden; height:100%; }
    #player { position:absolute; top:0; left:0; width:100%; height:100%; }
    /* Swallow long-press so Android's "save image"/share sheet on the video frame can't be triggered */
    * { -webkit-touch-callout:none; -webkit-user-select:none; user-select:none; }
  </style>
</head>
<body>
  <div id="player"></div>
  <script>
    var player;
    var ended = false;
    var apiReady = false;
    function post(type, data) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, data: data || null }));
      }
    }

    var tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    // If the IFrame API script itself can't load (blocked/offline/etc.) we'd
    // otherwise sit here forever with nothing on screen and no error event --
    // that also looks like a broken player to the student. Surface it.
    tag.onerror = function () { post('unavailable', 'script_load_failed'); };
    document.body.appendChild(tag);

    // Belt-and-braces: some embedding-disabled videos never fire onError at
    // all, they just never become ready. If the API hasn't reported ready
    // within 10s, treat it as unavailable too.
    setTimeout(function () {
      if (!apiReady) post('unavailable', 'timeout');
    }, 10000);

    function onYouTubeIframeAPIReady() {
      player = new YT.Player('player', {
        videoId: "${videoId}",
        playerVars: {
          autoplay: ${autoplay},
          playsinline: 1,
          modestbranding: 1,
          rel: 0,
          fs: 1,
          iv_load_policy: 3,
          controls: 1,
          origin: 'https://www.youtube.com'
        },
        events: {
          onReady: function () { apiReady = true; post('ready'); },
          onStateChange: function (e) {
            // 0 = ended, 1 = playing, 2 = paused, 3 = buffering
            if (e.data === 0 && !ended) {
              ended = true;
              post('ended');
            }
            if (e.data === 1) post('playing');
          },
          // YT error codes: 2 = bad videoId, 5 = HTML5 player error,
          // 100 = video not found/private, 101 & 150 = embedding disabled
          // by the video owner. 100/101/150 are what actually render as
          // "Video unavailable" inside the iframe -- treat those as a hard
          // failure so the app can swap in its own "Watch on YouTube" button
          // instead of leaving YouTube's broken embed on screen.
          onError: function (e) {
            post('error', e.data);
            if ([100, 101, 150].indexOf(e.data) !== -1) post('unavailable', e.data);
          }
        }
      });
    }

    // Block any attempt to tap through to youtube.com/watch, channel pages, etc.
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a');
      if (a && a.href && a.href.indexOf('youtube.com/watch') === -1) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);

    document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  </script>
</body>
</html>`;
}
