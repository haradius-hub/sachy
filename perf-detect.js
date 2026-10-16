/* =========================================================================
Šachy – perf-detect.js  (FIXED: benchmark ve Web Workeru)
Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
SPDX-License-Identifier: GPL-3.0-or-later

OPRAVA: benchmark nyní běží ve Web Workeru. Dřív používal globální
board/state/turn na hlavním vlákně a mohl zrušit hráčův probíhající tah.
========================================================================= */

(function () {
'use strict';

var PERF_KEY = 'sachy-perf-profile';
var DIFF_KEY = 'sachy-user-difficulty';
var profile = null;
var lastMs = null;

function loadProfile() {
try {
var raw = localStorage.getItem(PERF_KEY);
if (!raw) return;
var data = JSON.parse(raw);
if (data && data.profile) { profile = data.profile; lastMs = data.ms; }
} catch (e) {}
}
function saveProfile(p, ms) {
try { localStorage.setItem(PERF_KEY, JSON.stringify({ profile: p, ms: ms, at: Date.now() })); } catch (e) {}
}

function quickHardwareCheck() {
var cores = navigator.hardwareConcurrency || 0;
var mem = navigator.deviceMemory || 0;
if (cores === 0) return 'unknown';
if (cores <= 2) return 'very-slow';
if (mem > 0 && mem <= 4) return 'slow';
return 'ok';
}

function benchmarkInWorker() {
return new Promise(function (resolve, reject) {
var w;
try { w = new Worker('engine-worker.js'); }
catch (e) { return reject(e); }

var done = false;
var timeout = setTimeout(function () {
if (done) return;
done = true;
try { w.terminate(); } catch (e) {}
reject(new Error('Benchmark timeout'));
}, 12000);

w.onmessage = function (e) {
var msg = e.data || {};
if (msg.type === 'benchmark-result' && msg.id === 1) {
if (done) return;
done = true;
clearTimeout(timeout);
try { w.terminate(); } catch (e) {}
resolve(msg.ms);
} else if (msg.type === 'error' && msg.id === 1) {
if (done) return;
done = true;
clearTimeout(timeout);
try { w.terminate(); } catch (e) {}
reject(new Error(msg.message));
}
};
w.onerror = function (err) {
if (done) return;
done = true;
clearTimeout(timeout);
try { w.terminate(); } catch (e) {}
reject(err);
};
try { w.postMessage({ type: 'benchmark', id: 1 }); }
catch (e) {
if (done) return;
done = true;
clearTimeout(timeout);
reject(e);
}
});
}

function classify(ms) {
if (ms < 150) return 'fast';
if (ms < 600) return 'normal';
if (ms < 1800) return 'slow';
return 'very-slow';
}
function profileLabel(p) {
return { 'fast': 'rychlý', 'normal': 'běžný', 'slow': 'pomalejší', 'very-slow': 'velmi pomalý' }[p] || p;
}

function applyProfile(p) {
var diffSelect = document.getElementById('difficultySelect');
if (!diffSelect) return;

var userChoice = null;
try { userChoice = localStorage.getItem(DIFF_KEY); } catch (e) {}

if (!userChoice) {
if (p === 'fast') diffSelect.value = 'hard';
else if (p === 'normal') diffSelect.value = 'medium';
else if (p === 'slow') diffSelect.value = 'easy';
else if (p === 'very-slow') diffSelect.value = 'easy';
}

if (p === 'very-slow' || p === 'slow') {
try { if (window.sachySetLiteMode) window.sachySetLiteMode(true); } catch (e) {}
}

var info = document.getElementById('perfInfo');
if (info) {
info.textContent = 'Výkon: ' + profileLabel(p) +
(lastMs != null ? ' (' + Math.round(lastMs) + ' ms)' : '');
}
}

function runBenchmark() {
var el = document.getElementById('status');
var prev = el ? el.textContent : null;
if (el) el.textContent = 'Měřím výkon…';
benchmarkInWorker().then(function (ms) {
var p = classify(ms);
profile = p; lastMs = ms;
saveProfile(p, ms);
applyProfile(p);
if (el && el.textContent === 'Měřím výkon…') el.textContent = prev || 'Připraven.';
try { console.log('[perf] Profil:', p, '(' + Math.round(ms) + ' ms)'); } catch (e) {}
}).catch(function (err) {
console.warn('[perf] Benchmark selhal:', err && err.message);
if (el && el.textContent === 'Měřím výkon…') el.textContent = prev || 'Připraven.';
});
}

function injectButton() {
var boxes = document.querySelectorAll('.panel .box');
var target = null;
for (var i = 0; i < boxes.length; i++) {
var t = boxes[i].querySelector('.box-title');
if (t && t.textContent.indexOf('Nastavení hry') >= 0) { target = boxes[i]; break; }
}
if (!target) return;
if (target.querySelector('#perfTestBtn')) return;

var section = document.createElement('div');
section.style.marginTop = '10px';
section.style.paddingTop = '10px';
section.style.borderTop = '1px solid var(--line)';
section.style.fontSize = '12.5px';
section.style.color = 'var(--muted)';

var info = document.createElement('div');
info.id = 'perfInfo';
info.style.marginBottom = '6px';
info.textContent = profile
? ('Výkon: ' + profileLabel(profile) + (lastMs != null ? ' (' + Math.round(lastMs) + ' ms)' : ''))
: 'Výkon: nezměřeno';

var btn = document.createElement('button');
btn.id = 'perfTestBtn';
btn.className = 'btn btn-outline';
btn.style.padding = '5px 10px';
btn.style.fontSize = '12px';
btn.textContent = 'Změřit výkon';
btn.addEventListener('click', runBenchmark);

section.appendChild(info);
section.appendChild(btn);
target.appendChild(section);
}

function hookDifficultySave() {
var sel = document.getElementById('difficultySelect');
if (!sel) return;
sel.addEventListener('change', function () {
try { localStorage.setItem(DIFF_KEY, sel.value); } catch (e) {}
});
}

function init() {
loadProfile();
injectButton();
hookDifficultySave();

if (profile) { applyProfile(profile); return; }

var hw = quickHardwareCheck();
if (hw === 'very-slow' || hw === 'slow') {
profile = hw;
saveProfile(hw, null);
applyProfile(hw);
try { console.log('[perf] Hardware check: ' + hw + ' (benchmark přeskočen)'); } catch (e) {}
return;
}
if (hw === 'unknown') {
try { console.log('[perf] Hardware neznámý, benchmark se nespouští.'); } catch (e) {}
return;
}
setTimeout(runBenchmark, 1200);
}

if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 250); });
} else {
setTimeout(init, 250);
}
})();