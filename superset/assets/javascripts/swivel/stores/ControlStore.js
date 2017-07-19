export default class ControlStore {
  constructor(...data) {
    // Should queries be run automatically
    this.autoRun = true;

    // Schedule a run
    this.run = true;

    // Is query running
    this.isRunning = false;
    this.error = null;
    this.queryRequest = {};
    this.update(...data);
  }

  update(...data) {
    Object.assign(this, ...data);
  }
}
