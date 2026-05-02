// Helper partagé pour ouvrir IndexedDB sans risque de VersionError.
// Plusieurs modules ouvrent la même DB 'alpha-terminal' avec des versions hardcodées
// différentes (7, 8, 9, 10...). Si un module a déjà bumpé la DB à une version plus
// récente que celle qu'on demande, indexedDB.open(name, oldVersion) jette VersionError.
// Pattern : peek d'abord la version existante, puis ouvre avec max(existing, min).
export function openWithMinVersion(dbName, minVersion, onUpgrade) {
  return new Promise((resolve, reject) => {
    let peek;
    try { peek = indexedDB.open(dbName); }
    catch (e) { return reject(e); }
    peek.onerror = () => reject(peek.error);
    peek.onsuccess = () => {
      const existing = peek.result.version;
      peek.result.close();
      const target = Math.max(existing, minVersion);
      let req;
      try { req = indexedDB.open(dbName, target); }
      catch (e) { return reject(e); }
      req.onupgradeneeded = onUpgrade;
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('DB bloquée par un autre onglet'));
    };
  });
}
