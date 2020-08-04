import _ from 'lodash';
import gzipSize from 'gzip-size';

import Node from './Node';

export default class Module extends Node {

  constructor(name, data, parent) {
    super(name, parent);
    this.data = data;
  }

  get src() {
    return this.data.parsedSrc;
  }

  set src(value) {
    this.data.parsedSrc = value;
    delete this._gzipSize;
  }

  get size() {
    return this.data.size;
  }

  set size(value) {
    this.data.size = value;
  }

  get parsedSize() {
    return this.src ? this.src.length : undefined;
  }

  get gzipSize() {
    if (!_.has(this, '_gzipSize')) {
      this._gzipSize = this.src ? gzipSize.sync(this.src) : undefined;
    }

    return this._gzipSize;
  }

  mergeData(data) {
    if (data.size) {
      this.size += data.size;
    }

    if (data.parsedSrc) {
      this.src = (this.src || '') + data.parsedSrc;
    }
  }

  toChartData() {
    return {
      id: this.data.id,
      label: this.name,
      path: this.path,
      statSize: this.size,
      parsedSize: this.parsedSize,
      gzipSize: this.gzipSize
    };
  }

};
