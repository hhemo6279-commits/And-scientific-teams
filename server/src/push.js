import webpush from 'web-push';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const keysPath = path.join(__dirname, '..', 'data', 'vapid.keys.json');

export function getVapidKeys() {
  const envPub = process.env.VAPID_PUBLIC_KEY;
  const envPriv = process.env.VAPID_PRIVATE_KEY;
  if (envPub && envPriv) return { publicKey: envPub, privateKey: envPriv };
  try {
    if (fs.existsSync(keysPath)) {
      return JSON.parse(fs.readFileSync(keysPath, 'utf8'));
    }
  } catch { /* تجاهل */ }
  const keys = webpush.generateVAPIDKeys();
  try {
    fs.mkdirSync(path.dirname(keysPath), { recursive: true });
    fs.writeFileSync(keysPath, JSON.stringify(keys, null, 2));
  } catch { /* تجاهل */ }
  return keys;
}

const keys = getVapidKeys();
const contact = process.env.VAPID_CONTACT || 'mailto:admin@mk.io';
webpush.setVapidDetails(contact, keys.publicKey, keys.privateKey);

export function getPublicKey() {
  return keys.publicKey;
}

export function subscribePush(userId, subscription) {
  if (!subscription || !subscription.endpoint) return false;
  db.prepare(`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, endpoint) DO NOTHING
  `).run(userId, subscription.endpoint, subscription.keys?.p256dh || '', subscription.keys?.auth || '');
  return true;
}

export function unsubscribePush(userId, endpoint) {
  db.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?').run(userId, endpoint || '');
}

export async function sendPush(userId, title, body = '', url = '/') {
  const subs = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(userId);
  if (!subs.length) return;
  const payload = JSON.stringify({ title, body, url });
  await Promise.allSettled(subs.map((sub) => webpush.sendNotification(sub, payload)
    .catch((err) => {
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
      }
    })));
}

export function notifyAndPush(userId, title, content = '') {
  db.prepare('INSERT INTO notifications (user_id, title, content) VALUES (?,?,?)').run(userId, title, content);
  sendPush(userId, title, content).catch(() => {});
}