/**
 * LRU Cache class with limit
 *
 * Update order for each get/set operation
 * Delete oldest when reach given limit
 */

export default class LRUCache {
  constructor(limit = 5) {
    this.limit = limit;

    this.clear();
  }

  clear() {
    this._cache = {};
    // access/update order, first item is oldest, last item is newest
    this._order = [];
  }

  get(key) {
    const value = this._cache[key];
    if (value) {
      // update order
      this._deleteOrder(key);
      this._appendOrder(key);
    }
    return value;
  }

  set(key, value) {
    if (!this._cache[key]) {
      // if reach limit, delete the oldest
      if (Object.keys(this._cache).length === this.limit) {
        this.delete(this._order[0]);
      }

      this._cache[key] = value;
      this._appendOrder(key);
    } else {
      // if found in cache, delete the old one, insert new one to the first of list
      this.delete(key);

      this._cache[key] = value;
      this._appendOrder(key);
    }
  }

  delete(key) {
    const value = this._cache[key];
    if (value) {
      this._deleteCache(key);
      this._deleteOrder(key);
    }
  }

  _deleteCache(key) {
    delete this._cache[key];
  }

  _deleteOrder(key) {
    const index = this._order.findIndex(o => o === key);
    if (index >= 0) {
      this._order.splice(index, 1);
    }
  }

  _appendOrder(key) {
    this._order.push(key);
  }
}
