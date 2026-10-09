"use client";

// Mock storage for the parent's own media (P39 voice note, P40 movement clips): IndexedDB, because clips are far
// too big for localStorage. Live: uploaded to encrypted object storage; the answer keeps only the media id.

const DB_NAME = "fk_media";
const STORE = "blobs";

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((res, rej) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

export async function putMedia(blob: Blob): Promise<string> {
  const id = crypto.randomUUID();
  await tx("readwrite", (s) => s.put(blob, id));
  return id;
}
export const getMedia = (id: string) => tx<Blob | undefined>("readonly", (s) => s.get(id));
export const deleteMedia = (id: string) => tx("readwrite", (s) => s.delete(id));
