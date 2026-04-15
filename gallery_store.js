// IndexedDB-backed gallery storage for Flickgame projects.
(function () {
  'use strict';

  var DB_NAME = 'flickgame';
  var DB_VERSION = 1;
  var STORE_PROJECTS = 'projects';
  var dbPromise = null;

  function nowMs() { return Date.now(); }

  function uuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    // Fallback UUIDv4-ish
    var s = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      var v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    return s;
  }

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB not available'));
        return;
      }
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = function () { reject(req.error || new Error('Failed to open IndexedDB')); };
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
          var store = db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
    });
    return dbPromise;
  }

  function withStore(mode, fn) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_PROJECTS, mode);
        var store = tx.objectStore(STORE_PROJECTS);
        var result;
        try { result = fn(store, tx); } catch (e) { reject(e); return; }

        var txDone = false;
        var txError = null;
        tx.oncomplete = function () { txDone = true; maybeResolve(); };
        tx.onerror = function () { reject(tx.error || new Error('IndexedDB transaction failed')); };
        tx.onabort = function () { reject(tx.error || new Error('IndexedDB transaction aborted')); };

        var resultPromise = Promise.resolve(result);
        var resultDone = false;
        var resultValue;
        resultPromise.then(function (v) { resultDone = true; resultValue = v; maybeResolve(); }, function (e) {
          // If the caller's request promise fails, surface that error (tx may still abort too).
          txError = e || new Error('IndexedDB request failed');
          reject(txError);
        });

        function maybeResolve() {
          if (!txDone) return;
          if (txError) return;
          if (!resultDone) return;
          resolve(resultValue);
        }
      });
    });
  }

  function reqToPromise(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('IndexedDB request failed')); };
    });
  }

  function listProjects() {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_PROJECTS, 'readonly');
        var store = tx.objectStore(STORE_PROJECTS);
        var idx = store.index('updatedAt');
        var out = [];
        var cursorReq = idx.openCursor(null, 'prev');
        cursorReq.onerror = function () { reject(cursorReq.error || new Error('Failed to iterate projects')); };
        cursorReq.onsuccess = function () {
          var cur = cursorReq.result;
          if (!cur) { resolve(out); return; }
          out.push(cur.value);
          cur.continue();
        };
      });
    });
  }

  function getProject(id) {
    return withStore('readonly', function (store) {
      return reqToPromise(store.get(id));
    });
  }

  function putProject(project) {
    var p = Object.assign({}, project);
    if (!p.id) p.id = uuid();
    if (!p.title) p.title = 'Untitled';
    if (!p.createdAt) p.createdAt = nowMs();
    p.updatedAt = nowMs();
    return withStore('readwrite', function (store) {
      return reqToPromise(store.put(p)).then(function () { return p; });
    });
  }

  function deleteProject(id) {
    return withStore('readwrite', function (store) {
      return reqToPromise(store.delete(id)).then(function () { return true; });
    });
  }

  function isEmpty() {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_PROJECTS, 'readonly');
        var store = tx.objectStore(STORE_PROJECTS);
        var countReq = store.count();
        countReq.onerror = function () { reject(countReq.error || new Error('Failed to count projects')); };
        countReq.onsuccess = function () { resolve((countReq.result || 0) === 0); };
      });
    });
  }

  window.FlickGalleryStore = {
    openDb: openDb,
    listProjects: listProjects,
    getProject: getProject,
    putProject: putProject,
    deleteProject: deleteProject,
    isEmpty: isEmpty,
    _uuid: uuid
  };
})();
