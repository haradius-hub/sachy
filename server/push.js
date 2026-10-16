/* =========================================================================
   Web Push – VAPID klíče + odesílání notifikací.
   VAPID klíče se vygenerují při prvním startu a uloží do server/data/vapid.json.
   Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
   SPDX-License-Identifier: GPL-3.0-or-later
   ========================================================================= */

const webpush = require('web-push');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const VAPID_FILE = path.join(DATA_DIR, 'vapid.json');

let vapidKeys = null;
try {
  if (fs.existsSync(VAPID_FILE)) {
    vapidKeys = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8'));
  }
} catch (e) { vapidKeys = null; }

if (!vapidKeys || !vapidKeys.publicKey || !vapidKeys.privateKey) {
  vapidKeys = webpush.generateVAPIDKeys();
  try {
    fs.writeFileSync(VAPID_FILE, JSON.stringify(vapidKeys, null, 2));
    console.log('[push] Vygenerovány nové VAPID klíče do ' + VAPID_FILE);
  } catch (e) {
    console.error('[push] Nepodařilo se uložit VAPID klíče:', e);
  }
}

const CONTACT = process.env.VAPID_CONTACT || 'mailto:admin@example.com';
webpush.setVapidDetails(CONTACT, vapidKeys.publicKey, vapidKeys.privateKey);

function getPublicKey() { return vapidKeys.publicKey; }

/*
  Pošle notifikaci na danou push subscription.
  Vrací: {ok:true} | {gone:true} (subscription už neplatí) | {error}
*/
async function sendPush(subscription, payload) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { ok: true };
  } catch (err) {
    if (err && (err.statusCode === 410 || err.statusCode === 404)) {
      return { gone: true };
    }
    console.warn('[push] Chyba při odesílání:', err && err.message);
    return { error: err && err.message };
  }
}

module.exports = { getPublicKey, sendPush };
