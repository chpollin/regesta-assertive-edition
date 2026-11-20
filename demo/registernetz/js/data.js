// Loading of the prebuilt JSON-LD files (build_register_graph.py). One promise per file, so a
// file is fetched once per page life. A failed load rejects and is not cached.

const cache = new Map();

function load(path) {
  if (!cache.has(path)) {
    const p = fetch(path).then((res) => {
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    });
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return cache.get(path);
}

// Register ids and record uids come from the address, so they are checked against their
// delivered form before they become part of a path.
const ENTRY_ID = /^RI\d{3}-\d{3}-[A-Z]\d{6}$/;
const RECORD_UID = /^\d+$/;

export const validEntryId = (id) => ENTRY_ID.test(id);
export const validRecordUid = (uid) => RECORD_UID.test(uid);

export function loadEntry(id) {
  if (!validEntryId(id)) return Promise.reject(new Error("invalid"));
  return load(`data/entry/${id}.jsonld`);
}

export function loadRecord(uid) {
  if (!validRecordUid(uid)) return Promise.reject(new Error("invalid"));
  return load(`data/record/${uid}.jsonld`);
}

export const loadIndex = () => load("data/index.json");
