/* =========================================================================
   Šachy – analysis-export.js
   Export analýzy: PGN s anotacemi + Word (.docx) s grafem hodnocení.
   DOCX knihovna se načítá dynamicky z CDN (unpkg), aby nebyla potřeba
   při běžném hraní. Používá se globální `docx` z UMD buildu.
   Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
   SPDX-License-Identifier: GPL-3.0-or-later
   ========================================================================= */

(function () {
  'use strict';

  var lastReportData = null;
  var docxLoadingPromise = null;

  /* ---------- Zapamatuj si data z reportu ---------- */
  if (typeof showReport === 'function') {
    var _origShowReport = showReport;
    window.showReport = function (data) {
      lastReportData = data;
      _origShowReport.apply(this, arguments);
      injectButtons();
    };
  }

  /* ---------- Vlož tlačítka do report modalu ---------- */
  function injectButtons() {
    var foot = document.querySelector('#reportModal .report-foot');
    if (!foot) return;
    if (foot.querySelector('#expPgn')) return;
    foot.style.gap = '8px';
    foot.style.flexWrap = 'wrap';

    var bPgn = document.createElement('button');
    bPgn.id = 'expPgn';
    bPgn.className = 'btn btn-outline';
    bPgn.textContent = 'Export PGN s anotacemi';
    bPgn.addEventListener('click', exportAnnotatedPGN);

    var bDocx = document.createElement('button');
    bDocx.id = 'expDocx';
    bDocx.className = 'btn';
    bDocx.textContent = 'Export do Wordu';
    bDocx.addEventListener('click', exportReportDocx);

    foot.insertBefore(bPgn, foot.firstChild);
    foot.insertBefore(bDocx, foot.firstChild);
  }

  /* ---------- Načtení docx knihovny z CDN (jen když je potřeba) ---------- */
  function loadDocxLib() {
    if (typeof window.docx !== 'undefined' && window.docx.Packer) {
      return Promise.resolve(window.docx);
    }
    if (docxLoadingPromise) return docxLoadingPromise;
    docxLoadingPromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = 'https://unpkg.com/docx@8.5.0/build/index.umd.js';
      script.onload = function () {
        if (typeof window.docx !== 'undefined' && window.docx.Packer) {
          resolve(window.docx);
        } else {
          reject(new Error('docx se načetl, ale nemá Packer.'));
        }
      };
      script.onerror = function () {
        docxLoadingPromise = null;
        reject(new Error('Nepodařilo se stáhnout docx z CDN.'));
      };
      document.head.appendChild(script);
    });
    return docxLoadingPromise;
  }

  /* ---------- Pomocné ---------- */
  function fmtEval(cp) {
    if (Math.abs(cp) >= 999000) return cp > 0 ? '+M' : '-M';
    var p = cp / 100;
    return (p > 0 ? '+' : '') + p.toFixed(2);
  }
  function annotSymbol(v) {
    if (v === 1) return '?!';
    if (v === 2) return '?';
    if (v === 3) return '??';
    return '';
  }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '.' + pad2(d.getMonth() + 1) + '.' + pad2(d.getDate());
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function downloadText(content, filename, mime) {
    downloadBlob(new Blob([content], { type: mime || 'text/plain' }), filename);
  }

  /* ---------- 1) PGN s anotacemi ---------- */
  function exportAnnotatedPGN() {
    var d = lastReportData;
    if (!d) { showToast('Nejdřív spusť analýzu.'); return; }
    if (!moveListSAN || moveListSAN.length === 0) { showToast('Žádné tahy.'); return; }

    var NL = String.fromCharCode(10);
    var result = '?';
    if (d.result) {
      if (d.result.indexOf('1-0') >= 0) result = '1-0';
      else if (d.result.indexOf('0-1') >= 0) result = '0-1';
      else if (d.result.indexOf('Remíza') >= 0) result = '1/2-1/2';
    }

    var lines = [];
    lines.push('[Event "Analyzovaná partie"]');
    lines.push('[Site "Šachy (Better DeepSeek)"]');
    lines.push('[Date "' + todayStr() + '"]');
    lines.push('[Round "-"]');
    lines.push('[White "' + (playerColor === 'w' ? 'Hráč' : 'Počítač') + '"]');
    lines.push('[Black "' + (playerColor === 'b' ? 'Hráč' : 'Počítač') + '"]');
    lines.push('[Result "' + result + '"]');
    lines.push('[Opening "' + (d.opening ? d.opening.name : '?') + '"]');
    lines.push('[AccuracyWhite "' + d.w.accuracy.toFixed(1) + '"]');
    lines.push('[AccuracyBlack "' + d.b.accuracy.toFixed(1) + '"]');
    lines.push('');

    var cur = '';
    var targetLen = 78;
    for (var i = 0; i < moveListSAN.length; i++) {
      var token = moveListSAN[i];
      var annot = annotSymbol(gameAnnotations[i] || 0);
      var evalCp = (d.evals && i + 1 < d.evals.length) ? d.evals[i + 1] : 0;
      var evalStr = fmtEval(evalCp);
      var comment = '{' + evalStr + (annot ? ' ' + annot : '') + '}';
      var piece;
      if (i % 2 === 0) piece = (i / 2 + 1) + '. ' + token + ' ' + comment + ' ';
      else piece = token + ' ' + comment + ' ';
      if (cur.length + piece.length > targetLen) {
        lines.push(cur.trim());
        cur = '';
      }
      cur += piece;
    }
    if (cur.trim()) lines.push(cur.trim());
    lines.push(result);

    var pgn = lines.join(NL) + NL;
    downloadText(pgn, 'analyza-' + todayStr().replace(/\./g, '-') + '.pgn', 'application/x-chess-pgn');
    showToast('PGN s anotacemi stažen.');
  }

  /* ---------- 2) Word report ---------- */
  async function exportReportDocx() {
    var d = lastReportData;
    if (!d) { showToast('Nejdřív spusť analýzu.'); return; }

    try {
      showToast('Načítám Word knihovnu…');
      var docx = await loadDocxLib();
      var D = docx;

      var doc = new D.Document({
        creator: 'Šachy (Better DeepSeek)',
        title: 'Report partie',
        description: 'Analýza šachové partie',
        sections: [{
          children: buildDocxChildren(D, d)
        }]
      });

      var blob = await D.Packer.toBlob(doc);
      var fname = 'report-' + todayStr().replace(/\./g, '-') + '.docx';
      downloadBlob(blob, fname);
      showToast('Word dokument stažen.');
    } catch (err) {
      console.error('[analysis-export] Chyba při generování DOCX:', err);
      showToast('Nepodařilo se vytvořit Word: ' + (err.message || err));
    }
  }

  function buildDocxChildren(D, d) {
    var children = [];

    children.push(new D.Paragraph({
      text: 'Report partie',
      heading: D.HeadingLevel.HEADING_1,
      alignment: D.AlignmentType.CENTER,
      spacing: { after: 200 }
    }));

    children.push(new D.Paragraph({
      children: [
        new D.TextRun({ text: 'Vygenerováno: ' + todayStr(), italics: true, size: 20, color: '6b7280' })
      ],
      alignment: D.AlignmentType.CENTER,
      spacing: { after: 300 }
    }));

    children.push(new D.Paragraph({
      text: 'Přehled',
      heading: D.HeadingLevel.HEADING_2
    }));

    var metaRows = [
      ['Zahájení', d.opening ? d.opening.name : '?'],
      ['Výsledek', d.result || '?'],
      ['Půltahů', String(d.losses ? d.losses.length : 0)],
      ['Fáze', 'Zahájení: ' + d.phases.opening + ' · Střední: ' + d.phases.middlegame + ' · Koncovka: ' + d.phases.endgame]
    ];
    children.push(buildTable(D, ['Vlastnost', 'Hodnota'], metaRows));
    children.push(new D.Paragraph({ text: '', spacing: { after: 200 } }));

    children.push(new D.Paragraph({
      text: 'Přesnost',
      heading: D.HeadingLevel.HEADING_2
    }));
    var accRows = [
      ['Bílý', d.w.accuracy.toFixed(1) + ' %', String(d.w.total)],
      ['Černý', d.b.accuracy.toFixed(1) + ' %', String(d.b.total)]
    ];
    children.push(buildTable(D, ['Hráč', 'Přesnost', 'Tahů'], accRows));
    children.push(new D.Paragraph({ text: '', spacing: { after: 200 } }));

    children.push(new D.Paragraph({
      text: 'Klasifikace tahů',
      heading: D.HeadingLevel.HEADING_2
    }));
    var catRows = [
      ['Nejlepší / dobré', String(d.w.counts.best + d.w.counts.good), String(d.b.counts.best + d.b.counts.good)],
      ['Nepřesnosti (?!)', String(d.w.counts.inaccuracy), String(d.b.counts.inaccuracy)],
      ['Chyby (?)', String(d.w.counts.mistake), String(d.b.counts.mistake)],
      ['Hrubky (??)', String(d.w.counts.blunder), String(d.b.counts.blunder)]
    ];
    children.push(buildTable(D, ['Kategorie', 'Bílý', 'Černý'], catRows));
    children.push(new D.Paragraph({ text: '', spacing: { after: 200 } }));

    children.push(new D.Paragraph({
      text: 'Průběh hodnocení',
      heading: D.HeadingLevel.HEADING_2
    }));

    try {
      var imgBytes = buildEvalChartImageBytes(d.evals);
      if (imgBytes) {
        children.push(new D.Paragraph({
          children: [
            new D.ImageRun({
              data: imgBytes,
              transformation: { width: 600, height: 200 }
            })
          ],
          alignment: D.AlignmentType.CENTER,
          spacing: { after: 200 }
        }));
        children.push(new D.Paragraph({
          children: [
            new D.TextRun({
              text: 'Modrá čára = hodnocení pozice (centipawny / 100). Nahoře bílý, dole černý.',
              italics: true, size: 18, color: '6b7280'
            })
          ],
          alignment: D.AlignmentType.CENTER,
          spacing: { after: 300 }
        }));
      }
    } catch (imgErr) {
      console.warn('[analysis-export] Graf se nepovedl:', imgErr);
    }

    children.push(new D.Paragraph({
      text: 'Průběh tahů',
      heading: D.HeadingLevel.HEADING_2
    }));

    if (moveListSAN && moveListSAN.length > 0) {
      var moveRows = [];
      for (var i = 0; i < moveListSAN.length; i += 2) {
        var num = String(i / 2 + 1) + '.';
        var wm = moveListSAN[i] || '';
        var wa = annotSymbol(gameAnnotations[i] || 0);
        var bm = moveListSAN[i + 1] || '';
        var ba = annotSymbol(gameAnnotations[i + 1] || 0);
        moveRows.push([
          num,
          wm + (wa ? ' ' + wa : ''),
          bm + (ba ? ' ' + ba : '')
        ]);
      }
      children.push(buildTable(D, ['#', 'Bílý', 'Černý'], moveRows));
    }

    return children;
  }

  function buildTable(D, header, rows) {
    var tableRows = [];
    tableRows.push(new D.TableRow({
      children: header.map(function (h) {
        return new D.TableCell({
          shading: { fill: 'f0f2f5' },
          children: [new D.Paragraph({
            children: [new D.TextRun({ text: h, bold: true, size: 22 })]
          })]
        });
      })
    }));
    for (var i = 0; i < rows.length; i++) {
      tableRows.push(new D.TableRow({
        children: rows[i].map(function (cell) {
          return new D.TableCell({
            children: [new D.Paragraph({
              children: [new D.TextRun({ text: String(cell), size: 20 })]
            })]
          });
        })
      }));
    }
    return new D.Table({
      width: { size: 100, type: D.WidthType.PERCENTAGE },
      rows: tableRows
    });
  }

  /* ---------- Graf → Uint8Array (PNG bajty pro ImageRun) ---------- */
  function buildEvalChartImageBytes(evals) {
    if (!evals || evals.length < 2) return null;
    var W = 1200, H = 400;
    var canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext('2d');

    ctx.fillStyle = '#f6f7f9';
    ctx.fillRect(0, 0, W, H);

    var pad = 40;
    var innerW = W - 2 * pad;
    var innerH = H - 2 * pad;
    var baseline = pad + innerH / 2;
    var maxCp = 500;
    var n = evals.length - 1;

    ctx.strokeStyle = '#c8cbd0';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(pad, baseline);
    ctx.lineTo(pad + innerW, baseline);
    ctx.stroke();
    ctx.setLineDash([]);

    var points = [];
    for (var i = 0; i < evals.length; i++) {
      var v = evals[i];
      if (v > maxCp) v = maxCp;
      if (v < -maxCp) v = -maxCp;
      var x = pad + (i / n) * innerW;
      var y = pad + (1 - (v + maxCp) / (2 * maxCp)) * innerH;
      points.push({ x: x, y: y });
    }

    ctx.beginPath();
    ctx.moveTo(pad, baseline);
    for (var k = 0; k < points.length; k++) ctx.lineTo(points[k].x, points[k].y);
    ctx.lineTo(pad + innerW, baseline);
    ctx.closePath();
    ctx.fillStyle = 'rgba(77, 107, 254, 0.15)';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var m = 1; m < points.length; m++) ctx.lineTo(points[m].x, points[m].y);
    ctx.strokeStyle = '#4d6bfe';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#6b7280';
    ctx.font = '18px sans-serif';
    ctx.fillText('+5', 8, pad + 8);
    ctx.fillText('0', 20, baseline + 6);
    ctx.fillText('-5', 8, pad + innerH + 6);

    var dataURL = canvas.toDataURL('image/png');
    var b64 = dataURL.split(',')[1];
    var bin = atob(b64);
    var len = bin.length;
    var bytes = new Uint8Array(len);
    for (var b = 0; b < len; b++) bytes[b] = bin.charCodeAt(b);
    return bytes;
  }

  /* ---------- Init ---------- */
  function init() {
    if (document.getElementById('reportModal')) injectButtons();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 120); });
  } else {
    setTimeout(init, 120);
  }
})();
