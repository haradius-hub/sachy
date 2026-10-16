/* =========================================================================
Šachy – tests/engine-loader.js
Načte engine.js (přes server/engine-loader.js, aby byla jedna verze).
Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
SPDX-License-Identifier: GPL-3.0-or-later
========================================================================= */

'use strict';

const path = require('path');
module.exports = require(path.join(__dirname, '..', 'server', 'engine-loader.js'));