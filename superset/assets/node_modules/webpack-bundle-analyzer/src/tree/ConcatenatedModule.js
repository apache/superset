import _ from 'lodash';

import Module from './Module';
import ContentModule from './ContentModule';
import ContentFolder from './ContentFolder';
import {getModulePathParts} from './utils';

export default class ConcatenatedModule extends Module {

  constructor(name, data, parent) {
    super(name, data, parent);
    this.name += ' (concatenated)';
    this.children = Object.create(null);
    this.fillContentModules();
  }

  fillContentModules() {
    _.each(this.data.modules, moduleData => this.addContentModule(moduleData));
  }

  addContentModule(moduleData) {
    const pathParts = getModulePathParts(moduleData);

    if (!pathParts) {
      return;
    }

    const [folders, fileName] = [pathParts.slice(0, -1), _.last(pathParts)];
    let currentFolder = this;

    _.each(folders, folderName => {
      let childFolder = currentFolder.getChild(folderName);

      if (!childFolder) {
        childFolder = currentFolder.addChildFolder(new ContentFolder(folderName, this));
      }

      currentFolder = childFolder;
    });

    const module = new ContentModule(fileName, moduleData, this);
    currentFolder.addChildModule(module);
  }

  getChild(name) {
    return this.children[name];
  }

  addChildModule(module) {
    module.parent = this;
    this.children[module.name] = module;
  }

  addChildFolder(folder) {
    folder.parent = this;
    this.children[folder.name] = folder;
    return folder;
  }

  mergeNestedFolders() {
    _.invokeMap(this.children, 'mergeNestedFolders');
  }

  toChartData() {
    return {
      ...super.toChartData(),
      concatenated: true,
      groups: _.invokeMap(this.children, 'toChartData')
    };
  }

};
