/* =========================================================================
   Šachy – openings-extra.js
   Rozšíření opening book: přidá dalších 20 zahájení k původním 17.
   Načítá se po engine.js. Nic nepřepisuje, jen rozšiřuje pole.
   Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
   SPDX-License-Identifier: GPL-3.0-or-later
   ========================================================================= */

(function () {
  var lines = [
    ['d2d4','g8f6','c2c4','e7e6','g1f3','b7b6','g2g3','c8b7','f1g2','f8e7'],
    ['e2e4','e7e5','b1c3','g8f6','f2f4','d7d5','f4e5','f6e4'],
    ['e2e4','e7e5','f2f4','e5f4','g1f3','g7g5','h2h4','g5g4'],
    ['e2e4','d7d5','e4d5','d8d5','b1c3','d5a5'],
    ['e2e4','d7d6','d2d4','g8f6','b1c3','g7g6','g1f3','f8g7'],
    ['e2e4','g7g6','d2d4','f8g7','b1c3','d7d6','g1f3','g8f6'],
    ['e2e4','g8f6','e4e5','f6d5','d2d4','d7d6','g1f3','g7g6'],
    ['e2e4','b8c6','d2d4','d7d5','b1c3','d5e4'],
    ['d2d4','g8f6','c1g5','g7g6','b1c3','f8g7'],
    ['d2d4','g8f6','g1f3','e7e6','c1g5','h7h6','g5h4','g7g5'],
    ['d2d4','g8f6','c2c4','c7c5','d4d5','e7e6','b1c3','e6d5'],
    ['d2d4','g8f6','c2c4','c7c5','d4d5','b7b5','c4b5','a7a6'],
    ['d2d4','f7f5','g2g3','g8f6','f1g2','e7e6','g1f3','f8e7'],
    ['d2d4','g8f6','c2c4','e7e5','d4e5','f6g4','c1f4','b8c6'],
    ['f2f4','d7d5','g1f3','g7g6','e2e3','f8g7','f1e2','g8f6'],
    ['d2d4','d7d5','g1f3','g8f6','e2e3','e7e6','f1d3','c7c5'],
    ['c2c4','c7c5','b1c3','b8c6','g2g3','g7g6','f1g2','f8g7'],
    ['e2e4','e7e5','g1f3','b8c6','f1b5','g8f6','e1g1','f6e4'],
    ['e2e4','c7c5','b1c3','b8c6','g2g3','g7g6','f1g2','f8g7'],
    ['d2d4','e7e6','c2c4','f7f5','g1f3','g8f6','g2g3','f8e7']
  ];
  var names = [
    'Katalánská hra','Vídeňská hra','Královský gambit','Skandinávská obrana',
    'Pircova obrana','Moderní obrana','Aljechinova obrana','Nimzowitschova obrana',
    'Trompowsky','Torreho útok','Benoni','Benko gambit',
    'Holandská obrana','Budapešťský gambit','Birdova hra','Colleho systém',
    'Anglická symetrická','Španělská (berlínská)','Sicilská zavřená','Holandská (klasická)'
  ];
  for (var i = 0; i < lines.length; i++) {
    OPENING_BOOK.push(lines[i]);
    OPENING_NAMES.push(names[i]);
  }
})();
