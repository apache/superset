import BaseFolder from './BaseFolder';

export default class ContentFolder extends BaseFolder {

  constructor(name, ownerModule, parent) {
    super(name, parent);
    this.ownerModule = ownerModule;
  }

  get parsedSize() {
    return this.getSize('parsedSize');
  }

  get gzipSize() {
    return this.getSize('gzipSize');
  }

  getSize(sizeType) {
    const ownerModuleSize = this.ownerModule[sizeType];

    if (ownerModuleSize !== undefined) {
      return Math.floor((this.size / this.ownerModule.size) * ownerModuleSize);
    }
  }

  toChartData() {
    return {
      ...super.toChartData(),
      parsedSize: this.parsedSize,
      gzipSize: this.gzipSize,
      inaccurateSizes: true
    };
  }

};
