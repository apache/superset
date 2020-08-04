import _ from 'lodash';
import gzipSize from 'gzip-size';

import Module from './Module';
import BaseFolder from './BaseFolder';
import ConcatenatedModule from './ConcatenatedModule';
import {getModulePathParts} from './utils';

export default class Folder extends BaseFolder {

  get parsedSize() {
    return this.src ? this.src.length : 0;
  }

  get gzipSize() {
    if (!_.has(this, '_gzipSize')) {
      this._gzipSize = this.src ? gzipSize.sync(this.src) : 0;
    }

    return this._gzipSize;
  }

  addModule(moduleData) {
    const pathParts = getModulePathParts(moduleData);

    if (!pathParts) {
      return;
    }

    const [folders, fileName] = [pathParts.slice(0, -1), _.last(pathParts)];
    let currentFolder = this;

    _.each(folders, folderName => {
      let childNode = currentFolder.getChild(folderName);

      if (
        // Folder is not created yet
        !childNode ||
        // In some situations (invalid usage of dynamic `require()`) webpack generates a module with empty require
        // context, but it's moduleId points to a directory in filesystem.
        // In this case we replace this `File` node with `Folder`.
        // See `test/stats/with-invalid-dynamic-require.json` as an example.
        !(childNode instanceof Folder)
      ) {
        childNode = currentFolder.addChildFolder(new Folder(folderName));
      }

      currentFolder = childNode;
    });

    const ModuleConstructor = moduleData.modules ? ConcatenatedModule : Module;
    const module = new ModuleConstructor(fileName, moduleData, this);
    currentFolder.addChildModule(module);
  }

  toChartData() {
    return {
      ...super.toChartData(),
      parsedSize: this.parsedSize,
      gzipSize: this.gzipSize
    };
  }

};
