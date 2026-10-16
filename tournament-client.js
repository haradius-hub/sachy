/* =========================================================================
   Šachy – tournament-client.js
   UI pro turnaje (záložka v multiplayer modalu).
   Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
   SPDX-License-Identifier: GPL-3.0-or-later
   ========================================================================= */

(function () {
  'use strict';

  var currentTournament = null;
  var tournamentArea = null;

  function send(obj) { if (typeof window.mpSend === 'function') window.mpSend(obj); }
  function toast(text) {
    if (typeof showToast === 'function') { try { showToast(text); return; } catch (e) {} }
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = text; el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.hidden = true; }, 2400);
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function ensureTab() {
    var tabs = document.getElementById('mpTabs');
    if (!tabs || tabs.querySelector('[data-tab="tournament"]')) return;
    var b = document.createElement('button');
    b.className = 'mp-tab';
    b.dataset.tab = 'tournament';
    b.textContent = 'Turnaj';
    b.addEventListener('click', function () {
      var allTabs = tabs.querySelectorAll('.mp-tab');
      for (var i = 0; i < allTabs.length; i++) allTabs[i].classList.toggle('active', allTabs[i] === b);
      showTournamentTab();
    });
    tabs.appendChild(b);
    var modal = document.getElementById('mpModal');
    if (modal && !document.getElementById('mpTournament')) {
      var area = document.createElement('div');
      area.id = 'mpTournament';
      area.className = 'mp-area';
      area.hidden = true;
      modal.appendChild(area);
      tournamentArea = area;
    }
  }

  function hideOtherAreas() {
    ['mpLobby', 'mpRoom', 'mpHistory', 'mpLeaderboard'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.hidden = true;
    });
  }

  function showTournamentTab() {
    hideOtherAreas();
    if (!tournamentArea) tournamentArea = document.getElementById('mpTournament');
    if (!tournamentArea) return;
    tournamentArea.hidden = false;
    if (!currentTournament) {
      send({ type: 'list-tournaments' });
      renderTournamentList([]);
    } else {
      renderTournament(currentTournament);
    }
  }

  function renderTournamentList(list) {
    var html = '' +
      '<div class="mp-section">' +
      '  <h3>Nový turnaj</h3>' +
      '  <p class="hint-mini">Pavouk, single elimination. Remíza → partie se opakuje s prohozenými barvami (max 5×, pak rozhodne ELO).</p>' +
      '  <div class="controls">' +
      '    <button class="btn" data-create="4">Turnaj 4 hráči</button>' +
      '    <button class="btn btn-outline" data-create="8">8 hráčů</button>' +
      '    <button class="btn btn-outline" data-create="16">16 hráčů</button>' +
      '  </div>' +
      '</div>' +
      '<div class="mp-section">' +
      '  <h3>Otevřené turnaje</h3>' +
      '  <div class="mp-tournament-list">';
    if (!list || list.length === 0) {
      html += '<p class="hint-mini">Žádné otevřené turnaje.</p>';
    } else {
      for (var i = 0; i < list.length; i++) {
        var t = list[i];
        html += '<div class="mp-room-row">' +
          '<span>' + esc(t.name) + ' · ' + esc(t.host) + ' · ' + t.players + '/' + t.size + '</span>' +
          '<button class="btn btn-outline" data-join="' + esc(t.id) + '">Připojit</button>' +
          '</div>';
      }
    }
    html += '</div></div>';
    tournamentArea.innerHTML = html;
    tournamentArea.querySelectorAll('[data-create]').forEach(function (b) {
      b.addEventListener('click', function () {
        send({ type: 'create-tournament', size: parseInt(b.getAttribute('data-create'), 10) });
      });
    });
    tournamentArea.querySelectorAll('[data-join]').forEach(function (b) {
      b.addEventListener('click', function () {
        send({ type: 'join-tournament', tournamentId: b.getAttribute('data-join') });
      });
    });
  }

  function renderTournament(t) {
    if (!t) { renderTournamentList([]); return; }
    var myId = t.myId;
    var isHost = t.hostId === myId;
    var me = t.players.find(function (p) { return p.userId === myId; });

    var html = '' +
      '<div class="mp-section">' +
      '  <h3>' + esc(t.name) + ' · ' + t.size + ' hráčů · stav: ' + statusLabel(t.status) + '</h3>' +
      '  <p class="hint-mini">Kód: <code>' + esc(t.id) + '</code> · odkaz: <code>' + location.origin + location.pathname + '#tour=' + esc(t.id) + '</code></p>' +
      '  <div class="controls">' +
      '    <button id="tCopyLink" class="btn btn-outline">Kopírovat odkaz</button>';

    if (t.status === 'waiting') {
      if (!me) html += '    <button id="tJoin" class="btn">Připojit se</button>';
      else html += '    <button id="tLeave" class="btn btn-outline">Odhlásit se</button>';
      if (isHost && t.players.length === t.size) html += '    <button id="tStart" class="btn">Spustit turnaj</button>';
      html += '    <button id="tBack" class="btn btn-outline">Zpět na seznam</button>';
    } else {
      html += '    <button id="tBack" class="btn btn-outline">Zpět na seznam</button>';
    }
    html += '  </div>' +
      '</div>';

    html += '<div class="mp-section"><h3>Účastníci (' + t.players.length + '/' + t.size + ')</h3><div class="mp-player-chips">';
    for (var i = 0; i < t.players.length; i++) {
      var p = t.players[i];
      var cls = 'mp-chip' + (p.eliminated ? ' mp-chip-out' : '') + (p.userId === myId ? ' mp-chip-me' : '');
      html += '<span class="' + cls + '">' + esc(p.nickname) + (p.eliminated ? ' ✕' : '') + '</span>';
    }
    html += '</div></div>';

    if (t.bracket) {
      html += '<div class="mp-section"><h3>Pavouk</h3><div class="bracket">';
      for (var r = 0; r < t.bracket.length; r++) {
        html += '<div class="bracket-round"><div class="bracket-round-title">' + roundTitle(r, t.bracket.length) + '</div>';
        for (var m = 0; m < t.bracket[r].length; m++) {
          html += renderMatch(t.bracket[r][m], isHost, t);
        }
        html += '</div>';
      }
      html += '</div></div>';
    }

    if (t.status === 'finished' && t.winner) {
      html += '<div class="mp-section mp-winner">🏆 Vítěz turnaje: <b>' + esc(t.winner.nickname) + '</b></div>';
    }

    tournamentArea.innerHTML = html;

    var cp = tournamentArea.querySelector('#tCopyLink');
    if (cp) cp.addEventListener('click', function () {
      var url = location.origin + location.pathname + '#tour=' + t.id;
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(function () { toast('Odkaz zkopírován.'); });
      else window.prompt('Odkaz:', url);
    });
    var jn = tournamentArea.querySelector('#tJoin');
    if (jn) jn.addEventListener('click', function () { send({ type: 'join-tournament', tournamentId: t.id }); });
    var lv = tournamentArea.querySelector('#tLeave');
    if (lv) lv.addEventListener('click', function () { send({ type: 'leave-tournament', tournamentId: t.id }); });
    var st = tournamentArea.querySelector('#tStart');
    if (st) st.addEventListener('click', function () { send({ type: 'start-tournament', tournamentId: t.id }); });
    var bk = tournamentArea.querySelector('#tBack');
    if (bk) bk.addEventListener('click', function () { currentTournament = null; send({ type: 'list-tournaments' }); renderTournamentList([]); });

    tournamentArea.querySelectorAll('[data-start-match]').forEach(function (b) {
      b.addEventListener('click', function () {
        send({ type: 'start-tournament-match', tournamentId: t.id, matchId: b.getAttribute('data-start-match') });
      });
    });
    tournamentArea.querySelectorAll('[data-enter-match]').forEach(function (b) {
      b.addEventListener('click', function () {
        var roomId = b.getAttribute('data-enter-match');
        if (roomId) { location.hash = '#mp=' + roomId; location.reload(); }
      });
    });
  }

  function statusLabel(s) {
    if (s === 'waiting') return 'čeká na hráče';
    if (s === 'playing') return 'probíhá';
    if (s === 'finished') return 'dokončeno';
    return s;
  }
  function roundTitle(r, total) {
    var remaining = total - r;
    if (remaining === 1) return 'Finále';
    if (remaining === 2) return 'Semifinále';
    if (remaining === 3) return 'Čtvrtfinále';
    return 'Kolo ' + (r + 1);
  }

  function renderMatch(m, isHost, t) {
    var w = m.whiteNick || '—';
    var b = m.blackNick || '—';
    var statusCls = 'bracket-match status-' + m.status;
    var label = '';
    if (m.status === 'pending') label = 'Čeká';
    else if (m.status === 'ready') label = (m.replayCount > 0 ? 'Opakování ' + m.replayCount + '/' + (t.maxReplays || 5) : 'Připraven');
    else if (m.status === 'playing') label = 'Běží';
    else if (m.status === 'done') label = 'Dokončeno';

    var actions = '';
    if (m.status === 'ready' && isHost) {
      actions = '<button class="btn btn-outline" data-start-match="' + m.id + '">' +
        (m.replayCount > 0 ? 'Spustit opakování' : 'Spustit') +
        '</button>';
    } else if (m.status === 'playing' && m.roomId && ((t.myId === m.whiteId) || (t.myId === m.blackId))) {
      actions = '<button class="btn" data-enter-match="' + m.roomId + '">Vstoupit</button>';
    }

    var win = '';
    if (m.winnerId) {
      var winnerName = m.winnerId === m.whiteId ? w : b;
      win = '<span class="bracket-win">✓ ' + esc(winnerName);
      if (m.resolvedByElo) win += ' (ELO)';
      win += '</span>';
    }

    var replayBadge = '';
    if (m.replayCount && m.status !== 'ready') {
      replayBadge = '<span class="bracket-replay-badge">' + m.replayCount + '× remíza</span>';
    }

    return '<div class="' + statusCls + '">' +
      '<div class="bracket-players">' +
      '  <div class="bracket-p">' + esc(w) + '</div>' +
      '  <div class="bracket-p">' + esc(b) + '</div>' +
      '</div>' +
      '<div class="bracket-info">' + label + ' ' + win + ' ' + replayBadge + '</div>' +
      (actions ? '<div class="bracket-actions">' + actions + '</div>' : '') +
      '</div>';
  }

  function decorateTournament(t) {
    if (!t) return t;
    return t;
  }

  window.addEventListener('sachy-mp-msg', function (e) {
    var msg = e.detail;
    if (!msg) return;
    if (msg.type === 'tournament-created' || msg.type === 'tournament-joined' || msg.type === 'tournament-state') {
      currentTournament = decorateTournament(msg.tournament);
      if (!tournamentArea) ensureTab();
      showTournamentTab();
      if (msg.info) toast(msg.info);
    }
    if (msg.type === 'tournament-list') {
      if (!currentTournament) {
        if (!tournamentArea) ensureTab();
        if (tournamentArea && !tournamentArea.hidden) renderTournamentList(msg.tournaments);
      }
    }
  });

  var observer = new MutationObserver(function () {
    if (document.getElementById('mpModal')) ensureTab();
  });
  document.addEventListener('DOMContentLoaded', function () {
    observer.observe(document.body, { childList: true, subtree: true });
    if (document.getElementById('mpModal')) ensureTab();
  });

  window.addEventListener('load', function () {
    var h = location.hash || '';
    if (h.indexOf('#tour=') === 0) {
      var tid = h.slice(6).toUpperCase();
      setTimeout(function () {
        if (typeof window.mpSend === 'function') window.mpSend({ type: 'join-tournament', tournamentId: tid });
      }, 1200);
    }
  });
})();
