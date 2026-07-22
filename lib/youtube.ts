// Helpers for embedding YouTube videos in a locked-down way:
// - youtube-nocookie.com domain (no personalised suggestions/branding)
// - modestbranding + rel=0 + no info overlay
// - IFrame Player API wired up so we get a real "ended" event
//   (this is what lets us auto-move a finished live class into Lectures)

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

export function buildYouTubeEmbedHtml(videoId: string, opts?: { autoplay?: boolean; isLive?: boolean }) {
  const autoplay = opts?.autoplay ? 1 : 0;
  const isLive = !!opts?.isLive;
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>
    html, body { margin:0; padding:0; background:#000; overflow:hidden; height:100%; -webkit-tap-highlight-color:transparent; }
    * { -webkit-touch-callout:none; -webkit-user-select:none; user-select:none; box-sizing:border-box; }
    #stage { position:absolute; inset:0; background:#000; }
    #player, #player iframe { position:absolute; top:0; left:0; width:100%; height:100%; border:0; }
    #shield { position:absolute; inset:0; z-index:5; background:transparent; transition:background .25s; }
    #shield.paused { background:rgba(0,0,0,0.55); }
    #buffer { position:absolute; inset:0; z-index:6; display:flex; align-items:center; justify-content:center; pointer-events:none; }
    .spinner { width:38px; height:38px; border-radius:50%; border:3px solid rgba(255,255,255,0.25); border-top-color:#fff; animation:spin .8s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    #seekFlash { position:absolute; top:50%; z-index:7; transform:translateY(-50%); color:#fff; font:600 13px -apple-system,Roboto,sans-serif; background:rgba(0,0,0,0.55); padding:8px 12px; border-radius:20px; opacity:0; transition:opacity .15s; }
    #seekFlash.left { left:14%; }
    #seekFlash.right { right:14%; }
    #seekFlash.show { opacity:1; }
    #controls { position:absolute; inset:0; z-index:9; display:flex; flex-direction:column; justify-content:space-between; opacity:0; pointer-events:none; transition:opacity .18s; background:linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 68%, rgba(0,0,0,0.65) 100%); }
    #controls.show { opacity:1; pointer-events:auto; }
    .topRow { display:flex; align-items:center; padding:8px 10px; gap:8px; }
    .liveBadge { display:flex; align-items:center; gap:5px; background:#dc2626; color:#fff; font:700 10px -apple-system,Roboto,sans-serif; padding:3px 8px; border-radius:8px; }
    .liveBadge .dot { width:6px; height:6px; border-radius:50%; background:#fff; }
    .bottomRow { display:flex; align-items:center; gap:8px; padding:6px 10px 10px; }
    .timeTxt { color:#fff; font:600 11px -apple-system,Roboto,sans-serif; min-width:34px; text-align:center; }
    #seekBar { -webkit-appearance:none; appearance:none; flex:1; height:3px; border-radius:3px; background:rgba(255,255,255,0.35); outline:none; }
    #seekBar::-webkit-slider-thumb { -webkit-appearance:none; width:13px; height:13px; border-radius:50%; background:#fff; box-shadow:0 0 0 1px rgba(0,0,0,0.15); }
    .iconBtn { width:34px; height:34px; display:flex; align-items:center; justify-content:center; background:transparent; border:0; padding:0; position:relative; }
    .iconBtn svg { width:20px; height:20px; }
    #playBtn svg { position:absolute; top:7px; left:7px; opacity:0; transform:scale(.6); transition:opacity .16s ease, transform .16s ease; }
    #playBtn svg.on { opacity:1; transform:scale(1); }
    .liveJumpBtn { display:flex; align-items:center; gap:4px; border:1px solid rgba(255,255,255,0.5); border-radius:8px; padding:3px 8px; color:#fff; font:700 10px -apple-system,Roboto,sans-serif; background:transparent; transition:border-color .15s,color .15s; }
    .liveJumpBtn.atEdge { border-color:#dc2626; color:#dc2626; }
    .liveJumpBtn .dot { width:6px; height:6px; border-radius:50%; background:currentColor; margin-right:2px; }
    #seekBar:disabled { opacity:0.55; }
    .speedBtn { color:#fff; font:700 11px -apple-system,Roboto,sans-serif; }
    #qualityMenu, #speedMenu { position:absolute; right:8px; bottom:44px; z-index:10; background:rgba(28,28,28,0.96); border-radius:10px; padding:6px 0; min-width:100px; display:none; }
    #qualityMenu.show, #speedMenu.show { display:block; }
    #qualityMenu .qOpt, #speedMenu .qOpt { color:#fff; font:600 12px -apple-system,Roboto,sans-serif; padding:9px 14px; display:flex; justify-content:space-between; }
    #qualityMenu .qOpt.active, #speedMenu .qOpt.active { color:#3ea6ff; }
    .hidden { display:none !important; }
  </style>
</head>
<body>
  <div id="stage">
    <div id="player"></div>
    <div id="shield"></div>
    <div id="buffer" class="hidden"><div class="spinner"></div></div>
    <div id="seekFlash" class="left"></div>
    <div id="controls">
      <div class="topRow">
        <div id="liveBadgeTop" class="liveBadge hidden"><span class="dot"></span>LIVE</div>
      </div>
      <div class="bottomRow">
        <button class="iconBtn" id="playBtn">
          <svg id="iconPlay" class="on" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg>
          <svg id="iconPause" viewBox="0 0 24 24" fill="#fff"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>
        </button>
        <span class="timeTxt" id="curTime">0:00</span>
        <input type="range" id="seekBar" min="0" max="1000" value="0" />
        <span class="timeTxt" id="durTime">0:00</span>
        <button class="liveJumpBtn hidden" id="liveJumpBtn"><span class="dot"></span>LIVE</button>
        <button class="iconBtn hidden" id="speedBtn"><span class="speedBtn" id="speedLabel">1x</span></button>
        <button class="iconBtn" id="qualityBtn">
          <svg viewBox="0 0 24 24" fill="#fff"><path d="M19.14 12.94a7.14 7.14 0 0 0 .06-.94 7.14 7.14 0 0 0-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.63-.94L14.4 2.8a.5.5 0 0 0-.5-.4h-3.8a.5.5 0 0 0-.5.4l-.36 2.52a7.3 7.3 0 0 0-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58a7.14 7.14 0 0 0 0 1.88L2.82 14.5a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.04.72 1.63.94l.36 2.52a.5.5 0 0 0 .5.4h3.8a.5.5 0 0 0 .5-.4l.36-2.52a7.3 7.3 0 0 0 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/></svg>
        </button>
        <button class="iconBtn" id="fsBtn">
          <svg id="fsIcon" viewBox="0 0 24 24" fill="#fff"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
        </button>
      </div>
    </div>
    <div id="qualityMenu"></div>
    <div id="speedMenu"></div>
  </div>
  <script>
    var tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);

    var IS_LIVE = ${isLive ? "true" : "false"};
    var player, ended = false, isDraggingSeek = false, controlsTimer = null, tickTimer = null;

    function post(type, data) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, data: data === undefined ? null : data }));
      }
    }

    tag.onerror = function () { post('error', 'SCRIPT_LOAD_FAILED'); };
    setTimeout(function () { if (!player) post('error', 'SCRIPT_LOAD_TIMEOUT'); }, 10000);

    var els = {};
    ['controls','playBtn','iconPlay','iconPause','curTime','durTime','seekBar','liveJumpBtn','liveBadgeTop',
     'qualityBtn','qualityMenu','fsBtn','buffer','seekFlash','speedBtn','speedLabel','speedMenu','shield'].forEach(function (id) {
      els[id] = document.getElementById(id);
    });

    window.__fmt = function (sec) {
      if (!isFinite(sec) || sec < 0) sec = 0;
      var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
      var mm = h > 0 ? String(m).padStart(2, '0') : String(m);
      var ss = String(s).padStart(2, '0');
      return h > 0 ? (h + ':' + mm + ':' + ss) : (mm + ':' + ss);
    };

    function showControls(auto) {
      els.controls.classList.add('show');
      clearTimeout(controlsTimer);
      if (auto !== false) {
        controlsTimer = setTimeout(function () {
          if (!isDraggingSeek && !els.qualityMenu.classList.contains('show')) {
            els.controls.classList.remove('show');
          }
        }, 3000);
      }
    }
    function hideControls() { els.controls.classList.remove('show'); }

    function setPlayIcon(playing) {
      els.iconPlay.classList.toggle('on', !playing);
      els.iconPause.classList.toggle('on', playing);
      els.shield.classList.toggle('paused', !playing);
    }

    function flashSeek(text, side) {
      els.seekFlash.className = side + ' show';
      els.seekFlash.textContent = text;
      clearTimeout(els.seekFlash._t);
      els.seekFlash._t = setTimeout(function () { els.seekFlash.classList.remove('show'); }, 500);
    }

    function updateLiveUi() {
      if (!IS_LIVE || !player) return;
      var dur = player.getDuration() || 0;
      var cur = player.getCurrentTime() || 0;
      var atEdge = dur - cur < 8;
      els.liveJumpBtn.classList.remove('hidden');
      els.liveBadgeTop.classList.remove('hidden');
      if (atEdge) els.liveJumpBtn.classList.remove('atEdge');
      else els.liveJumpBtn.classList.add('atEdge');
    }

    function tick() {
      if (!player || typeof player.getCurrentTime !== 'function') return;
      var dur = player.getDuration() || 0;
      var cur = player.getCurrentTime() || 0;
      if (!isDraggingSeek) els.seekBar.value = dur > 0 ? Math.round((cur / dur) * 1000) : 0;
      els.curTime.textContent = window.__fmt(cur);
      els.durTime.textContent = IS_LIVE ? 'LIVE' : window.__fmt(dur);
      updateLiveUi();
      post('timeupdate', { currentTime: cur, duration: dur });
    }

    function togglePlay() {
      if (!player) return;
      var state = player.getPlayerState();
      if (state === 1) player.pauseVideo(); else player.playVideo();
    }

    els.playBtn.addEventListener('click', function (e) { e.stopPropagation(); togglePlay(); showControls(); });
    els.fsBtn.addEventListener('click', function (e) { e.stopPropagation(); post('fullscreentoggle'); });
    els.liveJumpBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!player) return;
      player.seekTo(1e9, true);
      player.playVideo();
      showControls();
    });

    els.seekBar.addEventListener('input', function () {
      if (IS_LIVE) return;
      isDraggingSeek = true; showControls(false);
    });
    els.seekBar.addEventListener('change', function () {
      if (!player || IS_LIVE) return;
      var dur = player.getDuration() || 0;
      var frac = Number(els.seekBar.value) / 1000;
      player.seekTo(dur * frac, true);
      isDraggingSeek = false;
      showControls();
    });

    els.speedBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!player || IS_LIVE) return;
      if (els.speedMenu.classList.contains('show')) { els.speedMenu.classList.remove('show'); return; }
      var rates = player.getAvailablePlaybackRates ? player.getAvailablePlaybackRates() : [0.5, 1, 1.25, 1.5, 2];
      var current = player.getPlaybackRate ? player.getPlaybackRate() : 1;
      els.speedMenu.innerHTML = '';
      rates.forEach(function (rate) {
        var row = document.createElement('div');
        row.className = 'qOpt' + (rate === current ? ' active' : '');
        row.textContent = rate === 1 ? 'Normal' : rate + 'x';
        row.addEventListener('click', function (ev) {
          ev.stopPropagation();
          player.setPlaybackRate(rate);
          els.speedLabel.textContent = rate + 'x';
          els.speedMenu.classList.remove('show');
          showControls();
        });
        els.speedMenu.appendChild(row);
      });
      els.speedMenu.classList.add('show');
      showControls(false);
    });

    els.qualityBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!player) return;
      if (els.qualityMenu.classList.contains('show')) { els.qualityMenu.classList.remove('show'); return; }
      var levels = player.getAvailableQualityLevels ? player.getAvailableQualityLevels() : [];
      var current = player.getPlaybackQuality ? player.getPlaybackQuality() : 'auto';
      var labels = { hd2160:'2160p', hd1440:'1440p', hd1080:'1080p', hd720:'720p', large:'480p', medium:'360p', small:'240p', tiny:'144p', auto:'Auto' };
      var opts = ['auto'].concat(levels.filter(function (l) { return l !== 'auto'; }));
      els.qualityMenu.innerHTML = '';
      opts.forEach(function (level) {
        var row = document.createElement('div');
        row.className = 'qOpt' + (level === current ? ' active' : '');
        row.textContent = labels[level] || level;
        row.addEventListener('click', function (ev) {
          ev.stopPropagation();
          player.setPlaybackQuality(level);
          els.qualityMenu.classList.remove('show');
          showControls();
        });
        els.qualityMenu.appendChild(row);
      });
      els.qualityMenu.classList.add('show');
      showControls(false);
    });

    var lastTapT = 0, lastTapX = 0;
    document.getElementById('shield').addEventListener('click', function (e) {
      var now = Date.now();
      var x = e.clientX, w = window.innerWidth;
      if (now - lastTapT < 320 && Math.abs(x - lastTapX) < 60) {
        if (!IS_LIVE && player) {
          var cur = player.getCurrentTime() || 0;
          if (x < w / 3) { player.seekTo(Math.max(0, cur - 10), true); flashSeek('-10s', 'left'); }
          else if (x > (w * 2) / 3) { player.seekTo(cur + 10, true); flashSeek('+10s', 'right'); }
          showControls();
        }
        lastTapT = 0;
        return;
      }
      lastTapT = now; lastTapX = x;
      if (els.controls.classList.contains('show')) { hideControls(); els.qualityMenu.classList.remove('show'); }
      else { showControls(); }
    });

    function onYouTubeIframeAPIReady() {
      player = new YT.Player('player', {
        videoId: "${videoId}",
        host: 'https://www.youtube-nocookie.com',
        playerVars: {
          autoplay: ${autoplay},
          playsinline: 1,
          modestbranding: 1,
          rel: 0,
          fs: 0,
          disablekb: 1,
          iv_load_policy: 3,
          controls: 0,
          origin: 'https://sarvodayadhyeta.online'
        },
        events: {
          onReady: function () {
            post('ready');
            if (IS_LIVE) {
              els.liveBadgeTop.classList.remove('hidden');
              els.liveJumpBtn.classList.remove('hidden');
              els.seekBar.setAttribute('disabled', 'disabled');
            } else {
              els.speedBtn.classList.remove('hidden');
            }
            showControls();
            clearInterval(tickTimer);
            tickTimer = setInterval(tick, 500);
          },
          onStateChange: function (e) {
            if (e.data === 0 && !ended) { ended = true; post('ended'); }
            if (e.data === 1) { post('playing'); setPlayIcon(true); els.buffer.classList.add('hidden'); }
            if (e.data === 2) { post('paused'); setPlayIcon(false); els.buffer.classList.add('hidden'); showControls(false); }
            if (e.data === 3) { els.buffer.classList.remove('hidden'); }
          },
          onError: function (e) { post('error', e.data); }
        }
      });
    }

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
