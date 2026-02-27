/**
 * Mursteiner Bus Card — liest Daten direkt aus HA-Entity
 * v2.0.0 — Für die Mursteiner HA-Integration
 *
 * Konfiguration:
 *   type: custom:mursteiner-bus-card
 *   entity: sensor.bus_5_kriemhildgasse  # Entity-ID des Bus-Sensors
 *   title: 'Bus 5 → Heiligengeistplatz'  # Optional
 *   color: '#4FC3F7'                     # Optional
 */

class MursteinerBusCard extends HTMLElement {

  set hass(hass) {
    this._hass = hass;
    if (this._built) {
      this._updateFromEntity();
    }
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error('Bitte "entity" angeben (z.B. sensor.bus_5_kriemhildgasse)');
    }
    this._config = Object.assign({
      title: '',
      color: '#4FC3F7',
    }, config);

    if (!this._built) {
      this.attachShadow({ mode: 'open' });
      this._built = true;
    }
    this._buildDOM();
  }

  _buildDOM() {
    var c = this._config;
    var color = c.color;
    var dimColor = this._hexToRgba(color, 0.15);
    var glowColor = this._hexToRgba(color, 0.3);

    this.shadowRoot.innerHTML = ''
      + '<style>'
      + ':host { display: block; }'
      + 'ha-card { padding: 16px; }'
      + '.header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }'
      + '.bus-icon {'
      + '  width: 48px; height: 48px; border-radius: 12px;'
      + '  background: ' + dimColor + ';'
      + '  display: flex; align-items: center; justify-content: center; flex-shrink: 0;'
      + '}'
      + '.bus-icon svg { width: 28px; height: 28px; fill: ' + color + '; }'
      + '.header-text { flex: 1; }'
      + '.title { font-size: 16px; font-weight: 600; color: var(--primary-text-color, #fff); }'
      + '.subtitle { font-size: 12px; color: var(--secondary-text-color, #aaa); margin-top: 2px; }'
      + '.departures { display: flex; flex-direction: column; gap: 8px; }'
      + '.dep-row {'
      + '  display: flex; align-items: center; gap: 12px;'
      + '  padding: 10px 12px; border-radius: 10px;'
      + '  background: ' + dimColor + '; transition: opacity 0.3s;'
      + '}'
      + '.dep-row.first {'
      + '  background: ' + this._hexToRgba(color, 0.2) + ';'
      + '  box-shadow: 0 0 12px ' + glowColor + ';'
      + '}'
      + '.line-badge {'
      + '  background: ' + color + '; color: #000; font-weight: 700; font-size: 14px;'
      + '  padding: 4px 10px; border-radius: 6px; min-width: 36px; text-align: center; flex-shrink: 0;'
      + '}'
      + '.dep-info { flex: 1; min-width: 0; }'
      + '.dep-time { font-size: 14px; color: var(--primary-text-color, #fff); }'
      + '.dep-dest { font-size: 11px; color: var(--secondary-text-color, #aaa); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }'
      + '.dep-delay { font-size: 11px; color: #ff6b6b; font-weight: 600; }'
      + '.countdown {'
      + '  font-size: 22px; font-weight: 700; color: ' + color + ';'
      + '  text-align: right; min-width: 55px; flex-shrink: 0; line-height: 1;'
      + '}'
      + '.countdown small { font-size: 11px; font-weight: 400; opacity: 0.7; }'
      + '.countdown.now { color: #4caf50; animation: pulse 1s infinite; }'
      + '@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }'
      + '.no-data { text-align: center; padding: 24px; color: var(--secondary-text-color, #aaa); font-size: 14px; }'
      + '.error { color: #ff6b6b; }'
      + '</style>'
      + '<ha-card>'
      + '  <div class="header">'
      + '    <div class="bus-icon">'
      + '      <svg viewBox="0 0 24 24"><path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4S4 2.5 4 6v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/></svg>'
      + '    </div>'
      + '    <div class="header-text">'
      + '      <div class="title" id="title">' + this._esc(c.title || 'Bus') + '</div>'
      + '      <div class="subtitle" id="subtitle">Wird geladen…</div>'
      + '    </div>'
      + '  </div>'
      + '  <div class="departures" id="departures">'
      + '    <div class="no-data">Lade Abfahrten…</div>'
      + '  </div>'
      + '</ha-card>';

    this._elDepartures = this.shadowRoot.getElementById('departures');
    this._elSubtitle = this.shadowRoot.getElementById('subtitle');
    this._elTitle = this.shadowRoot.getElementById('title');
  }

  connectedCallback() {
    this._stopTimer();
    // Countdown jede Sekunde aktualisieren
    this._tickTimer = setInterval(this._updateCountdowns.bind(this), 1000);
  }

  disconnectedCallback() {
    this._stopTimer();
  }

  _stopTimer() {
    if (this._tickTimer) { clearInterval(this._tickTimer); this._tickTimer = null; }
  }

  _updateFromEntity() {
    if (!this._hass || !this._config) return;
    var entityId = this._config.entity;
    var state = this._hass.states[entityId];

    if (!state) {
      if (this._elDepartures) {
        this._elDepartures.innerHTML = '<div class="no-data error">Entity "' + this._esc(entityId) + '" nicht gefunden</div>';
      }
      return;
    }

    var attrs = state.attributes || {};
    var departures = attrs.departures || [];

    // Titel und Untertitel
    if (this._elTitle && !this._config.title) {
      this._elTitle.textContent = (attrs.line || 'Bus') + ' → ' + (attrs.direction || '').replace(/^Klagenfurt\s+/i, '');
    }
    if (this._elSubtitle) {
      this._elSubtitle.textContent = attrs.station || entityId;
    }

    this._departures = departures;
    this._renderDepartures();
  }

  _renderDepartures() {
    var el = this._elDepartures;
    if (!el) return;
    var departures = this._departures || [];

    if (departures.length === 0) {
      el.innerHTML = '<div class="no-data">Keine Abfahrten</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < departures.length; i++) {
      var d = departures[i];
      var lineNum = (d.line || '').replace('Bus ', '');
      var dest = d.destination || '';
      var scheduled = d.scheduled || '';
      var realtime = d.realtime || scheduled;
      var delay = d.delay_minutes || 0;
      var isFirst = i === 0;

      var delayHtml = '';
      if (delay > 0) {
        delayHtml = '<div class="dep-delay">+' + delay + ' min</div>';
      }

      html += ''
        + '<div class="dep-row' + (isFirst ? ' first' : '') + '" data-idx="' + i + '">'
        + '  <div class="line-badge">' + this._esc(lineNum) + '</div>'
        + '  <div class="dep-info">'
        + '    <div class="dep-time">' + this._esc(scheduled) + (delay > 0 ? ' → ' + this._esc(realtime) : '') + '</div>'
        + '    <div class="dep-dest">→ ' + this._esc(dest) + '</div>'
        + '    ' + delayHtml
        + '  </div>'
        + '  <div class="countdown" id="cd-' + i + '">--</div>'
        + '</div>';
    }

    el.innerHTML = html;
    this._updateCountdowns();
  }

  _updateCountdowns() {
    var departures = this._departures;
    if (!departures) return;
    var now = new Date();

    for (var i = 0; i < departures.length; i++) {
      var cdEl = this.shadowRoot.getElementById('cd-' + i);
      if (!cdEl) continue;

      var d = departures[i];
      var minsUntil = d.minutes_until;

      // Die Entity liefert minutes_until zum Zeitpunkt des letzten Updates.
      // Wir berechnen den Countdown basierend auf scheduled/realtime-Zeit.
      var time = d.realtime || d.scheduled || '';
      var date = d.date || '';
      var parts = date.split('.');
      var timeParts = time.split(':');

      if (parts.length >= 3 && timeParts.length >= 2) {
        var depDate = new Date(
          parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]),
          parseInt(timeParts[0]), parseInt(timeParts[1]), 0
        );
        var diffMs = depDate.getTime() - now.getTime();
        var diffMin = Math.ceil(diffMs / 60000);

        if (diffMin <= 0) {
          cdEl.className = 'countdown now';
          cdEl.innerHTML = 'Jetzt';
        } else if (diffMin <= 60) {
          cdEl.className = 'countdown';
          cdEl.innerHTML = diffMin + '<small> min</small>';
        } else {
          var h = Math.floor(diffMin / 60);
          var m = diffMin % 60;
          cdEl.className = 'countdown';
          cdEl.innerHTML = h + ':' + (m < 10 ? '0' : '') + m + '<small> h</small>';
        }
      } else if (minsUntil !== null && minsUntil !== undefined) {
        cdEl.className = 'countdown';
        cdEl.innerHTML = minsUntil + '<small> min</small>';
      } else {
        cdEl.innerHTML = '--';
      }
    }
  }

  _hexToRgba(hex, alpha) {
    if (!hex || hex.startsWith('rgba') || hex.startsWith('rgb')) return hex || 'transparent';
    var r = 0, g = 0, b = 0;
    hex = hex.replace('#', '');
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    }
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  _esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  getCardSize() {
    return 3;
  }

  static getStubConfig() {
    return {
      entity: 'sensor.bus_5_kriemhildgasse',
      color: '#4FC3F7',
    };
  }
}

customElements.define('mursteiner-bus-card', MursteinerBusCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'mursteiner-bus-card',
  name: 'Mursteiner Bus',
  description: 'Busabfahrten mit Countdown — liest aus HA-Entity',
  preview: true,
});

console.info('%c MURSTEINER-BUS-CARD %c v2.0.0 ', 'color: #4FC3F7; background: #222; font-weight: bold;', 'color: #fff; background: #4FC3F7; font-weight: bold;');
