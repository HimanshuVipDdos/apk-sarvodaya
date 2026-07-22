// Helpers for embedding YouTube videos in a locked-down way:
// - youtube-nocookie.com domain (no personalised suggestions/branding)
// - modestbranding + rel=0 + no info overlay
// - IFrame Player API wired up so we get a real "ended" event
//   (this is what lets us auto-move a finished live class into Lectures)

// Maps the YouTube IFrame Player API's onError codes to messages a student
// can actually act on, instead of a silent black box with nothing on screen.
// https://developers.google.com/youtube/iframe_api_reference#onError
export function describeYouTubeError(code: number | null | undefined): string {
  const suffix = code !== null && code !== undefined ? ` (Error ${code})` : "";
  switch (code) {
    case 2:
      return "This video link looks invalid. Please tell your teacher — the video ID may be wrong." + suffix;
    case 5:
      return "This video can't play in this app right now. Try again in a moment." + suffix;
    case 100:
      return "This video was removed or made private by its owner." + suffix;
    case 101:
    case 150:
      return "The video owner has disabled playback in embedded apps like this one." + suffix;
    default:
      return "Couldn't load this video. Please check your connection and try again." + suffix;
  }
}

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
    var tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);

    var player;
    var ended = false;
    var loadStartedAt = Date.now();

    function post(type, data) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, data: data || null }));
      }
    }

    // If the YouTube iframe_api script itself never loads (network drop,
    // firewall blocking youtube.com, DNS hiccup), onYouTubeIframeAPIReady
    // never fires and nothing else in this page ever posts a message back —
    // React Native would be stuck showing a spinner forever with no way to
    // know anything failed. This catches that specific silent-failure case.
    tag.onerror = function () {
      post('error', 'SCRIPT_LOAD_FAILED');
    };
    setTimeout(function () {
      if (!player) post('error', 'SCRIPT_LOAD_TIMEOUT');
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
          origin: 'https://sarvodayadhyeta.online'
        },
        events: {
          onReady: function () { post('ready'); },
          onStateChange: function (e) {
            // 0 = ended, 1 = playing, 2 = paused, 3 = buffering
            if (e.data === 0 && !ended) {
              ended = true;
              post('ended');
            }
            if (e.data === 1) post('playing');
          },
          onError: function (e) { post('error', e.data); }
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
