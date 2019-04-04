'use strict';

const fs = require('fs');
const path = require('path');
const common = require('./common');
const EventEmitter = require('events').EventEmitter;
let fsevents;

try {
  fsevents = require('fsevents');
} catch (e) {
  // Ignore.
}

/**
 * Constants
 */

const CHANGE_EVENT = common.CHANGE_EVENT;
const DELETE_EVENT = common.DELETE_EVENT;
const ADD_EVENT = common.ADD_EVENT;
const ALL_EVENT = common.ALL_EVENT;

/**
 * Export `FSEventsWatcher` class.
 * Watches `dir`.
 *
 * @class FSEventsWatcher
 * @param String dir
 * @param {Object} opts
 * @public
 */

module.exports = class FSEventsWatcher extends EventEmitter {
  constructor(dir, opts) {
    if (!fsevents) {
      throw new Error(
        '`fsevents` unavailable (this watcher can only be used on Darwin)'
      );
    }

    super();

    common.assignOptions(this, opts);

    this.root = path.resolve(dir);
    this.watcher = fsevents(this.root);

    this.watcher.start().on('change', this.handleEvent.bind(this));
    this._tracked = Object.create(null);
    common.recReaddir(
      this.root,
      filepath => (this._tracked[filepath] = true),
      filepath => (this._tracked[filepath] = true),
      this.emit.bind(this, 'ready'),
      this.emit.bind(this, 'error'),
      this.ignored
    );
  }

  handleEvent(filepath) {
    const relativePath = path.relative(this.root, filepath);
    if (
      !common.isFileIncluded(this.globs, this.dot, this.doIgnore, relativePath)
    ) {
      return;
    }

    fs.lstat(
      filepath,
      function(error, stat) {
        if (error && error.code !== 'ENOENT') {
          this.emit('error', error);
          return;
        }

        if (error) {
          // Ignore files that aren't tracked and don't exist.
          if (!this._tracked[filepath]) {
            return;
          }

          this._emit(DELETE_EVENT, relativePath);
          delete this._tracked[filepath];
          return;
        }

        if (this._tracked[filepath]) {
          this._emit(CHANGE_EVENT, relativePath, stat);
        } else {
          this._tracked[filepath] = true;
          this._emit(ADD_EVENT, relativePath, stat);
        }
      }.bind(this)
    );
  }

  /**
   * End watching.
   *
   * @public
   */

  close(callback) {
    this.watcher.stop();
    this.removeAllListeners();
    if (typeof callback === 'function') {
      process.nextTick(callback.bind(null, null, true));
    }
  }

  /**
   * Emit events.
   *
   * @private
   */

  _emit(type, file, stat) {
    this.emit(type, file, this.root, stat);
    this.emit(ALL_EVENT, type, file, this.root, stat);
  }
};
