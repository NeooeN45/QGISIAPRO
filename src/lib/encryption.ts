/**
 * Chiffrement des clés API stockées localement.
 *
 * Format v2 (recommandé) : AES-GCM 256 bits via WebCrypto, avec une clé maître
 * NON EXTRACTIBLE persistée dans IndexedDB (le matériel de clé n'est jamais
 * exposé au JS). Chaque valeur est préfixée par "v2:".
 *
 * Format legacy (v1) : XOR à clé fixe — conservé UNIQUEMENT en lecture pour
 * migrer les clés déjà stockées. Ne plus utiliser en écriture.
 *
 * Note de sécurité honnête : pour une application s'exécutant côté client, aucun
 * schéma n'est inviolable face à un XSS ou à un attaquant local déterminé (la
 * clé de déchiffrement vit forcément sur la machine). AES-GCM + clé IndexedDB
 * non extractible protège contre l'inspection triviale (DevTools) et le rejeu,
 * ce que le XOR ne faisait pas. Pour un secret réellement sensible, préférer un
 * stockage côté backend (QgsSettings / keychain OS).
 */

const V2_PREFIX = "v2:";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers d'encodage
// ─────────────────────────────────────────────────────────────────────────────

function utf8ToBase64(str: string): string {
  try {
    const utf8Bytes = new TextEncoder().encode(str);
    return bytesToBase64(utf8Bytes);
  } catch {
    return "";
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64ToUtf8(base64: string): string {
  try {
    return new TextDecoder().decode(base64ToBytes(base64));
  } catch {
    return "";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AES-GCM (WebCrypto) — format v2
// ─────────────────────────────────────────────────────────────────────────────

const DB_NAME = "geoai-secure";
const DB_STORE = "keys";
const MASTER_KEY_ID = "aes-gcm-master-v2";

function webCryptoAvailable(): boolean {
  return (
    typeof crypto !== "undefined" &&
    typeof crypto.subtle !== "undefined" &&
    typeof indexedDB !== "undefined"
  );
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet<T>(key: string): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(DB_STORE, "readonly");
        const req = tx.objectStore(DB_STORE).get(key);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error);
      })
  );
}

function idbPut(key: string, value: unknown): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(DB_STORE, "readwrite");
        tx.objectStore(DB_STORE).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      })
  );
}

let masterKeyPromise: Promise<CryptoKey> | null = null;

/** Récupère (ou génère puis persiste) la clé maître AES-GCM non extractible. */
function getMasterKey(): Promise<CryptoKey> {
  if (masterKeyPromise) return masterKeyPromise;
  masterKeyPromise = (async () => {
    const existing = await idbGet<CryptoKey>(MASTER_KEY_ID);
    if (existing) return existing;
    const key = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false, // non extractible : le matériel de clé ne sort jamais
      ["encrypt", "decrypt"]
    );
    await idbPut(MASTER_KEY_ID, key);
    return key;
  })();
  return masterKeyPromise;
}

/**
 * Chiffre une clé API (format v2 AES-GCM). Repli sur le format legacy XOR si
 * WebCrypto est indisponible (contexte non sécurisé), afin de ne jamais bloquer.
 */
export async function encryptApiKeyAsync(apiKey: string): Promise<string> {
  if (!apiKey) return "";
  if (!webCryptoAvailable()) return encryptApiKey(apiKey);
  try {
    const key = await getMasterKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new TextEncoder().encode(apiKey);
    const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
    const cipherBytes = new Uint8Array(cipher);
    const combined = new Uint8Array(iv.length + cipherBytes.length);
    combined.set(iv, 0);
    combined.set(cipherBytes, iv.length);
    return V2_PREFIX + bytesToBase64(combined);
  } catch {
    return encryptApiKey(apiKey);
  }
}

/**
 * Déchiffre une clé API. Gère le format v2 (AES-GCM) ET, par compatibilité, les
 * anciennes valeurs XOR (v1) pour migration transparente.
 */
export async function decryptApiKeyAsync(stored: string): Promise<string> {
  if (!stored) return "";
  if (stored.startsWith(V2_PREFIX)) {
    if (!webCryptoAvailable()) return "";
    try {
      const key = await getMasterKey();
      const combined = base64ToBytes(stored.slice(V2_PREFIX.length));
      const iv = combined.slice(0, 12);
      const cipher = combined.slice(12);
      const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
      return new TextDecoder().decode(plain);
    } catch {
      return "";
    }
  }
  // Valeur legacy (v1) : déchiffrement XOR pour migration.
  return decryptApiKey(stored);
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy XOR (v1) — lecture seule pour migration. Ne plus utiliser en écriture.
// ─────────────────────────────────────────────────────────────────────────────

const ENCRYPTION_KEY = "GeoAI-QGIS-2024-Encryption-Key";

function xorEncrypt(text: string, key: string): string {
  let result = "";
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return utf8ToBase64(result);
}

function xorDecrypt(encrypted: string, key: string): string {
  try {
    const decoded = base64ToUtf8(encrypted);
    if (decoded) {
      let result = "";
      for (let i = 0; i < decoded.length; i++) {
        result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
      }
      if (result && !/[\x00-\x08\x0b-\x0c\x0e-\x1f]/.test(result)) return result;
    }
    try {
      const legacyDecoded = atob(encrypted);
      let result = "";
      for (let i = 0; i < legacyDecoded.length; i++) {
        result += String.fromCharCode(legacyDecoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
      }
      return result;
    } catch {
      return "";
    }
  } catch {
    return "";
  }
}

/**
 * @deprecated Format v1 (XOR). Conservé pour migration. Utiliser
 * `encryptApiKeyAsync` (AES-GCM) pour toute nouvelle écriture.
 */
export function encryptApiKey(apiKey: string): string {
  if (!apiKey) return "";
  try {
    return xorEncrypt(apiKey, ENCRYPTION_KEY);
  } catch {
    return apiKey;
  }
}

/**
 * @deprecated Format v1 (XOR). Conservé pour migration. Utiliser
 * `decryptApiKeyAsync` qui gère v2 ET v1.
 */
export function decryptApiKey(encryptedApiKey: string): string {
  if (!encryptedApiKey) return "";
  try {
    return xorDecrypt(encryptedApiKey, ENCRYPTION_KEY);
  } catch {
    return encryptedApiKey;
  }
}

/** Masque une clé API pour l'affichage (inchangé). */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length <= 8) {
    return "•".repeat(apiKey.length || 8);
  }
  return `${apiKey.slice(0, 4)}${"•".repeat(Math.max(apiKey.length - 8, 4))}${apiKey.slice(-4)}`;
}
