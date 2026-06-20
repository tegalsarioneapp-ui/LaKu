/* =========================================================
   MokuDB — IndexedDB wrapper
   RT 005 RW 012 · BOP RT 005 Offline Manager
   
   Stores:
     photos       — foto MoKu (dataUrl + metadata)
     bop_snapshots — snapshot data BOP
     moku_state   — backup state MoKu
   ========================================================= */
"use strict";

const MokuDB = (() => {
  const DB_NAME    = "bop_rt005_idb_v1";
  const DB_VERSION = 1;
  let _dbPromise   = null;

  /* ── Open / Upgrade ──────────────────────────────────── */
  function openDB() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("IndexedDB tidak tersedia")); return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("photos")) {
          const s = db.createObjectStore("photos", { keyPath: "id" });
          s.createIndex("activityId", "activityId", { unique: false });
          s.createIndex("capturedAt", "capturedAt", { unique: false });
        }
        if (!db.objectStoreNames.contains("bop_snapshots")) {
          db.createObjectStore("bop_snapshots", { keyPath: "ts" });
        }
        if (!db.objectStoreNames.contains("moku_state")) {
          db.createObjectStore("moku_state", { keyPath: "key" });
        }
      };
      req.onsuccess = e => { _dbPromise = Promise.resolve(e.target.result); resolve(e.target.result); };
      req.onerror   = e => { _dbPromise = null; reject(e.target.error); };
      req.onblocked = () => { _dbPromise = null; reject(new Error("IndexedDB diblokir")); };
    });
    return _dbPromise;
  }

  /* ── Helpers ─────────────────────────────────────────── */
  function run(storeName, mode, fn) {
    return openDB().then(db => new Promise((resolve, reject) => {
      try {
        const tx  = db.transaction(storeName, mode);
        const req = fn(tx.objectStore(storeName));
        req.onsuccess = () => resolve(req.result);
        req.onerror   = () => reject(req.error);
      } catch(e) { reject(e); }
    }));
  }

  function runGetAll(storeName) {
    return openDB().then(db => new Promise((resolve, reject) => {
      try {
        const tx  = db.transaction(storeName, "readonly");
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror   = () => reject(req.error);
      } catch(e) { reject(e); }
    }));
  }

  function runGetAllByIndex(storeName, indexName, key) {
    return openDB().then(db => new Promise((resolve, reject) => {
      try {
        const tx  = db.transaction(storeName, "readonly");
        const req = tx.objectStore(storeName).index(indexName).getAll(key);
        req.onsuccess = () => resolve(req.result || []);
        req.onerror   = () => reject(req.error);
      } catch(e) { reject(e); }
    }));
  }

  /* ── Public API ──────────────────────────────────────── */
  return {
    isAvailable() {
      return typeof indexedDB !== "undefined";
    },

    /* Photos */
    savePhoto(photo) {
      return run("photos", "readwrite", s => s.put(photo));
    },
    getPhoto(id) {
      return run("photos", "readonly", s => s.get(id));
    },
    deletePhoto(id) {
      return run("photos", "readwrite", s => s.delete(id));
    },
    getAllPhotos() {
      return runGetAll("photos");
    },
    getPhotosByActivity(activityId) {
      return runGetAllByIndex("photos", "activityId", activityId);
    },
    deletePhotosForActivity(activityId) {
      return this.getPhotosByActivity(activityId).then(photos =>
        Promise.all(photos.map(p => this.deletePhoto(p.id)))
      );
    },

    /* BOP Snapshots */
    saveBopSnapshot(data) {
      return run("bop_snapshots", "readwrite", s => s.put({ ts: Date.now(), data }));
    },
    getAllBopSnapshots() {
      return runGetAll("bop_snapshots");
    },
    getLatestBopSnapshot() {
      return this.getAllBopSnapshots()
        .then(arr => arr.sort((a, b) => b.ts - a.ts)[0] || null);
    },

    /* MoKu State Backup */
    saveMokuState(stateObj) {
      const lean = { key: "latest", savedAt: Date.now(), ...stateObj };
      return run("moku_state", "readwrite", s => s.put(lean));
    },
    getMokuState() {
      return run("moku_state", "readonly", s => s.get("latest"));
    },

    /* Stats */
    async getStats() {
      try {
        const [photos, snaps] = await Promise.all([
          this.getAllPhotos(),
          this.getAllBopSnapshots()
        ]);
        const byAct = {};
        photos.forEach(p => {
          byAct[p.activityId] = (byAct[p.activityId] || 0) + 1;
        });
        return {
          totalPhotos:     photos.length,
          totalActivities: Object.keys(byAct).length,
          totalSnapshots:  snaps.length,
          sizeEstimateKB:  Math.round(photos.reduce((s, p) => s + (p.dataUrl?.length || 0), 0) / 1024)
        };
      } catch(_) {
        return { totalPhotos:0, totalActivities:0, totalSnapshots:0, sizeEstimateKB:0 };
      }
    }
  };
})();
