/**
 * Mursteiner Departure Card v4.0
 * ÖBB HAFAS Abfahrten — Bus, Zug, alles
 *
 *   type: custom:mursteiner-bus-card
 *   entity: sensor.bus_5_kriemhildgasse   # oder sensor.rjx_klagenfurt_hbf etc.
 *   title: 'Bus 5 → Heiligengeistplatz'   # Optional
 *   color: '#4FC3F7'                       # Optional
 *   max_entries: 5                         # Optional (1-20)
 */

class MursteinerBusCard extends HTMLElement {

  set hass(hass) {
    this._hass = hass;
    if (this._built) this._updateFromEntity();
  }

  setConfig(config) {
    if (!config.entity) throw new Error('Bitte "entity" angeben');
    this._config = Object.assign({ color: '#4FC3F7', max_entries: 5 }, config);
    if (!this._built) { this.attachShadow({ mode: 'open' }); this._built = true; }
    this._buildDOM();
  }

  _buildDOM() {
    var c = this._config, col = c.color;
    this.shadowRoot.innerHTML = '<style>' + this._css(col) + '</style>'
      + '<ha-card>'
      + '<div class="card-inner">'
      + '  <div class="hero" id="hero">'
      + '    <div class="hero-icon" id="hero-icon">' + this._transportSvg(col, '') + '</div>'
      + '    <div class="hero-content">'
      + '      <div class="hero-mins" id="hero-mins">--</div>'
      + '      <div class="hero-label" id="hero-label">min</div>'
      + '    </div>'
      + '    <div class="hero-meta">'
      + '      <div class="hero-title" id="title">' + this._esc(c.title || '') + '</div>'
      + '      <div class="hero-sub" id="subtitle"></div>'
      + '    </div>'
      + '  </div>'
      + '  <div class="list" id="list"></div>'
      + '</div>'
      + '</ha-card>';
    this._elHeroMins = this.shadowRoot.getElementById('hero-mins');
    this._elHeroLabel = this.shadowRoot.getElementById('hero-label');
    this._elTitle = this.shadowRoot.getElementById('title');
    this._elSubtitle = this.shadowRoot.getElementById('subtitle');
    this._elList = this.shadowRoot.getElementById('list');
    this._elHero = this.shadowRoot.getElementById('hero');
  }

  _css(col) {
    var dim = this._rgba(col, 0.12);
    var mid = this._rgba(col, 0.2);
    var glow = this._rgba(col, 0.35);
    return ''
      + ':host { display:block; --accent:' + col + '; --dim:' + dim + '; --mid:' + mid + '; --glow:' + glow + '; }'
      + 'ha-card { background:transparent !important; box-shadow:none !important; overflow:hidden; }'
      + '.card-inner { padding:0; }'

      // Hero — großer Countdown oben
      + '.hero {'
      + '  display:flex; align-items:center; gap:16px; padding:20px 20px 16px;'
      + '  background:linear-gradient(135deg, var(--dim) 0%, transparent 100%);'
      + '  border-bottom:1px solid var(--dim);'
      + '  position:relative; overflow:hidden;'
      + '}'
      + '.hero::before {'
      + '  content:""; position:absolute; top:-40px; right:-40px; width:120px; height:120px;'
      + '  background:radial-gradient(circle, var(--glow) 0%, transparent 70%);'
      + '  opacity:0.5; pointer-events:none;'
      + '}'
      + '.hero-icon { width:44px; height:44px; border-radius:12px; background:var(--mid);'
      + '  display:flex; align-items:center; justify-content:center; flex-shrink:0; overflow:hidden; }'
      + '.hero-icon svg { width:26px; height:26px; }'
      + '.hero-icon img { width:40px; height:40px; object-fit:contain; }'
      + '.hero-icon .oebb-logo { width:40px; height:28px; border-radius:4px; background:#E2001A;'
      + '  display:flex; align-items:center; justify-content:center; }'
      + '.hero-icon .oebb-logo span { color:#fff; font-weight:900; font-size:11px; letter-spacing:.5px; font-family:Arial,sans-serif; }'
      + '.hero-icon .rj-logo { width:42px; height:30px; border-radius:4px;'
      + '  background:linear-gradient(135deg, #C8102E 0%, #E2001A 50%, #DC143C 100%);'
      + '  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0; }'
      + '.hero-icon .rj-logo .rj-text { color:#fff; font-weight:900; font-size:12px; line-height:1; font-family:Arial,sans-serif; letter-spacing:1px; }'
      + '.hero-icon .rj-logo .rj-sub { color:rgba(255,255,255,.7); font-size:6px; font-weight:600; line-height:1; letter-spacing:.3px; text-transform:uppercase; font-family:Arial,sans-serif; }'
      + '.hero-content { text-align:center; min-width:64px; flex-shrink:0; }'
      + '.hero-mins {'
      + '  font-size:42px; font-weight:800; line-height:1; color:var(--accent);'
      + '  font-variant-numeric:tabular-nums; letter-spacing:-2px;'
      + '}'
      + '.hero-mins.now { color:#66bb6a; }'
      + '.hero-label { font-size:11px; text-transform:uppercase; letter-spacing:1px;'
      + '  color:var(--secondary-text-color,#888); margin-top:2px; font-weight:600; }'
      + '.hero-meta { flex:1; min-width:0; }'
      + '.hero-title { font-size:15px; font-weight:700; color:var(--primary-text-color,#fff);'
      + '  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }'
      + '.hero-sub { font-size:12px; color:var(--secondary-text-color,#888); margin-top:2px;'
      + '  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }'

      // Departure list
      + '.list { padding:8px 12px 12px; display:flex; flex-direction:column; gap:6px; }'
      + '.row {'
      + '  display:flex; align-items:center; gap:10px; padding:8px 10px;'
      + '  border-radius:10px; background:var(--dim); transition:all .2s;'
      + '}'
      + '.row:first-child { background:var(--mid); }'

      // Line badge
      + '.badge {'
      + '  background:var(--accent); color:#000; font-weight:800; font-size:13px;'
      + '  padding:3px 8px; border-radius:6px; min-width:28px; text-align:center; flex-shrink:0;'
      + '  line-height:1.3;'
      + '}'

      // Time + destination
      + '.info { flex:1; min-width:0; }'
      + '.time { font-size:13px; color:var(--primary-text-color,#fff); font-weight:500; }'
      + '.delay { color:#ef5350; font-weight:700; font-size:12px; }'
      + '.dest { font-size:11px; color:var(--secondary-text-color,#888);'
      + '  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }'

      // Countdown pill
      + '.cd {'
      + '  font-size:18px; font-weight:700; color:var(--accent); min-width:48px;'
      + '  text-align:right; flex-shrink:0; font-variant-numeric:tabular-nums;'
      + '}'
      + '.cd small { font-size:10px; font-weight:500; opacity:.6; }'
      + '.cd.now { color:#66bb6a; font-size:14px; font-weight:800; }'

      // Progress bar under first row
      + '.progress { height:2px; border-radius:1px; background:var(--dim); margin:0 10px 4px; overflow:hidden; }'
      + '.progress-bar { height:100%; background:var(--accent); border-radius:1px; transition:width 1s linear; }'

      // Pulse animation for "Jetzt"
      + '@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }'
      + '.pulse { animation:pulse 1.5s ease-in-out infinite; }'

      // Empty state
      + '.empty { text-align:center; padding:20px; color:var(--secondary-text-color,#888); font-size:13px; }'
      + '.empty svg { width:32px; height:32px; fill:var(--secondary-text-color,#555); margin-bottom:8px; display:block; margin:0 auto 8px; }'
      ;
  }

  connectedCallback() {
    this._stopTimer();
    this._tickTimer = setInterval(this._tick.bind(this), 1000);
  }
  disconnectedCallback() { this._stopTimer(); }
  _stopTimer() { if (this._tickTimer) { clearInterval(this._tickTimer); this._tickTimer = null; } }

  _updateFromEntity() {
    if (!this._hass || !this._config) return;
    var state = this._hass.states[this._config.entity];
    if (!state) {
      if (this._elList) this._elList.innerHTML = '<div class="empty">Entity nicht gefunden</div>';
      return;
    }
    var a = state.attributes || {};
    if (this._elTitle && !this._config.title) {
      var dir = (a.direction || '').replace(/^Klagenfurt\s+/i, '').replace(/^Wien\s+/i, 'Wien ');
      this._elTitle.textContent = (a.line || '') + (a.line && dir ? ' → ' : '') + dir;
    }
    if (this._elSubtitle) this._elSubtitle.textContent = a.station || '';
    this._departures = (a.departures || []).slice(0, this._config.max_entries);
    // Icon dynamisch anpassen
    var iconEl = this.shadowRoot.getElementById('hero-icon');
    if (iconEl && this._departures.length) {
      iconEl.innerHTML = this._transportSvg(this._config.color, this._departures[0].line || a.line || '');
    }
    this._renderList();
    this._tick();
  }

  _renderList() {
    var el = this._elList; if (!el) return;
    var deps = this._departures || [];
    if (!deps.length) {
      el.innerHTML = '<div class="empty">'
        + '<svg viewBox="0 0 24 24"><path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4S4 2.5 4 6v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/></svg>'
        + 'Keine Abfahrten verfügbar</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < deps.length; i++) {
      var d = deps[i];
      var num = (d.line || '').replace('Bus ', '');
      var sched = d.scheduled || '';
      var real = d.realtime || sched;
      var dly = d.delay_minutes || 0;
      var timeStr = sched;
      if (dly > 0) timeStr = '<span class="delay">' + this._esc(real) + '</span> <s style="opacity:.4;font-size:11px">' + this._esc(sched) + '</s>';
      else timeStr = this._esc(sched);

      html += '<div class="row">'
        + '<div class="badge">' + this._esc(num) + '</div>'
        + '<div class="info">'
        + '  <div class="time">' + timeStr + (dly > 0 ? ' <span class="delay">+' + dly + '\'</span>' : '') + '</div>'
        + '  <div class="dest">' + this._esc(d.destination || '') + '</div>'
        + '</div>'
        + '<div class="cd" id="cd' + i + '">--</div>'
        + '</div>';
      if (i === 0) html += '<div class="progress"><div class="progress-bar" id="pbar"></div></div>';
    }
    el.innerHTML = html;
  }

  _tick() {
    var deps = this._departures; if (!deps || !deps.length) return;
    var now = new Date();
    for (var i = 0; i < deps.length; i++) {
      var el = this.shadowRoot.getElementById('cd' + i);
      if (!el) continue;
      var m = this._minsUntil(deps[i], now);
      if (m === null) { el.textContent = '--'; continue; }
      if (m <= 0) { el.className = 'cd now pulse'; el.textContent = 'Jetzt'; }
      else if (m < 60) { el.className = 'cd'; el.innerHTML = m + '<small> min</small>'; }
      else { var h = Math.floor(m/60), r = m%60; el.className = 'cd'; el.innerHTML = h + ':' + (r<10?'0':'') + r + '<small>h</small>'; }
    }
    // Hero
    var first = this._minsUntil(deps[0], now);
    if (first !== null && this._elHeroMins) {
      if (first <= 0) {
        this._elHeroMins.textContent = 'Jetzt';
        this._elHeroMins.className = 'hero-mins now pulse';
        this._elHeroLabel.textContent = '';
      } else {
        this._elHeroMins.textContent = first;
        this._elHeroMins.className = 'hero-mins';
        this._elHeroLabel.textContent = first === 1 ? 'Minute' : 'Minuten';
      }
    }
    // Progress bar (0-30 min range)
    var pbar = this.shadowRoot.getElementById('pbar');
    if (pbar && first !== null) {
      var pct = Math.max(0, Math.min(100, 100 - (first / 30 * 100)));
      pbar.style.width = pct + '%';
    }
  }

  _minsUntil(d, now) {
    var t = d.realtime || d.scheduled || '';
    var dt = d.date || '';
    var p = dt.split('.'), tp = t.split(':');
    if (p.length < 3 || tp.length < 2) return d.minutes_until != null ? d.minutes_until : null;
    var dep = new Date(+p[2], +p[1]-1, +p[0], +tp[0], +tp[1], 0);
    return Math.max(0, Math.ceil((dep - now) / 60000));
  }

  _transportSvg(col, line) {
    var ll = (line || '').toLowerCase();
    // Railjet / Railjet Xpress
    if (/\b(rjx)\b/.test(ll)) {
      return '<div class="rj-logo"><span class="rj-text">RJX</span><span class="rj-sub">railjet xpress</span></div>';
    }
    if (/\brj\b/.test(ll) && !/rjx/.test(ll)) {
      return '<div class="rj-logo"><span class="rj-text">RJ</span><span class="rj-sub">railjet</span></div>';
    }
    // Andere ÖBB Züge (IC, EC, ICE, REX, S)
    if (/\b(ic|ec|ice|rex)\b/.test(ll) || /^s\s?\d/.test(ll)) {
      return '<div class="oebb-logo"><span>ÖBB</span></div>';
    }
    // Bus-Icon
    return '<svg viewBox="0 0 24 24" fill="' + col + '"><path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4S4 2.5 4 6v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/></svg>';
  }
  _rgba(hex, a) {
    if (!hex || !hex.startsWith('#')) return hex || 'transparent';
    hex = hex.replace('#','');
    if (hex.length===3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    return 'rgba('+parseInt(hex.substr(0,2),16)+','+parseInt(hex.substr(2,2),16)+','+parseInt(hex.substr(4,2),16)+','+a+')';
  }
  _esc(s) { return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''; }
  getCardSize() { return 3; }
  static getStubConfig() { return { entity:'sensor.bus_5_kriemhildgasse', color:'#4FC3F7' }; }
}

customElements.define('mursteiner-bus-card', MursteinerBusCard);
window.customCards = window.customCards || [];
window.customCards.push({ type:'mursteiner-bus-card', name:'Mursteiner Abfahrten', description:'ÖBB HAFAS Abfahrten — Bus, Zug, etc.', preview:true });
console.info('%c MURSTEINER %c v4.0 ', 'color:#4FC3F7;background:#111;font-weight:bold;padding:2px 6px;', 'color:#fff;background:#4FC3F7;font-weight:bold;padding:2px 6px;');
