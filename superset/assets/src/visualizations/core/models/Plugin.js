import isRequired from '../../../utils/isRequired';

export default class Plugin {
  constructor(key = isRequired('key')) {
    this.key = key;
  }

  getInstalledKey() {
    return this.installedKey || this.key;
  }

  setInstalledKey(key) {
    this.installedKey = key;
    return this;
  }

  install(key = this.key) {
    this.setInstalledKey(key);
    return this;
  }
}
