import Stat from './stat';

export default class Stats {
  constructor({id, stats}) {
    this.id = id;
    this.stats = {};

    this._initializeStats(stats);

    Object.seal(this);
  }

  // Acquire a stat. Create if it doesn't exist.
  get(name, type = 'count') {
    return this._getOrCreate({name, type});
  }

  get size() {
    return Object.keys(this.stats).length;
  }

  // Reset all stats
  reset() {
    for (const key in this.stats) {
      this.stats[key].reset();
    }

    return this;
  }

  forEach(fn) {
    for (const key in this.stats) {
      fn(this.stats[key]);
    }
  }

  getTable() {
    const table = {};
    this.forEach(stat => {
      table[stat.name] = {
        time: stat.time || 0,
        count: stat.count || 0,
        average: stat.getAverageTime() || 0,
        hz: stat.getHz() || 0
      };
    });

    return table;
  }

  _initializeStats(stats = []) {
    stats.forEach(stat => this._getOrCreate(stat));
  }

  _getOrCreate(stat) {
    if (!stat || !stat.name) {
      return null;
    }

    const {name, type} = stat;
    if (!this.stats[name]) {
      if (stat instanceof Stat) {
        this.stats[name] = stat;
      } else {
        this.stats[name] = new Stat(name, type);
      }
    }
    return this.stats[name];
  }
}
