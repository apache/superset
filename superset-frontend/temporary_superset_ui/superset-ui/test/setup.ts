import { configure } from '@superset-ui/translation';

configure();

const caches = {};

class Cache {
  cache: object;
  constructor(key: string) {
    caches[key] = caches[key] || {};
    this.cache = caches[key];
  }
  match(url: string): Promise<Response | undefined> {
    return new Promise((resolve, reject) => resolve(this.cache[url]));
  }
  delete(url: string): Promise<boolean> {
    delete this.cache[url];
    return new Promise((resolve, reject) => resolve(true));
  }
  put(url: string, response: Response): Promise<void> {
    this.cache[url] = response;
    return Promise.resolve();
  }
};

class CacheStorage {
  open(key: string): Promise<Cache> {
    return new Promise((resolve, reject) => {
      resolve(new Cache(key));
    });
  }
  delete(key: string): Promise<boolean> {
    const wasPresent = key in caches;
    if (wasPresent) {
      caches[key] = undefined;
    }

    return Promise.resolve(wasPresent);
  }
};

global.caches = new CacheStorage();
