import isRequired from '../utils/isRequired';

export default class Plugin {
  constructor(key = isRequired('key')) {
    this.key = key;
  }

  setInstalledKey(key) {
    this.installedKey = key;
  }

  install(key = this.key) {
    this.setInstalledKey(key);
  }
}
