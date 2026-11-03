// IndexedDB draft storage for 128-page games that exceed localStorage quotas.
(function () {
  'use strict';

  var databasePromise = null;

  function openDatabase() {
    if (databasePromise) return databasePromise;
    databasePromise = new Promise(function (resolve, reject) {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is unavailable'));
        return;
      }
      var request = indexedDB.open('flickgame-big-draft', 1);
      request.onupgradeneeded = function () {
        request.result.createObjectStore('draft');
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error('Could not open draft storage')); };
      request.onblocked = function () { reject(new Error('Draft storage is blocked by another tab')); };
    });
    return databasePromise;
  }

  function save(state) {
    return openDatabase().then(function (database) {
      return new Promise(function (resolve, reject) {
        var transaction = database.transaction('draft', 'readwrite');
        transaction.objectStore('draft').put(state, 'current');
        transaction.oncomplete = function () { resolve(); };
        transaction.onerror = function () { reject(transaction.error || new Error('Could not save draft')); };
        transaction.onabort = function () { reject(transaction.error || new Error('Draft save was aborted')); };
      });
    });
  }

  function load() {
    return openDatabase().then(function (database) {
      return new Promise(function (resolve, reject) {
        var transaction = database.transaction('draft', 'readonly');
        var request = transaction.objectStore('draft').get('current');
        request.onsuccess = function () { resolve(request.result || null); };
        request.onerror = function () { reject(request.error || new Error('Could not load draft')); };
      });
    });
  }

  window.FlickBigDraft = { save: save, load: load };
})();
