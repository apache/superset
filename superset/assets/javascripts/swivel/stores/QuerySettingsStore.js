export default class QuerySettingsStore {
  constructor(...data) {
        // Query related settings
    this.filters = [];
    this.splits = [];
    this.limit = null;
    this.orderBy = null;
    this.orderDesc = true;
    this.datasource = '';
    this.metrics = {};

        // TODO these should be in VizSettingsStore
    this.vizType = 'table';

    this.update(...data);
  }

  update(...data) {
    Object.assign(this, ...data);
  }

  getNextState(...args) {
    const updates = Object.assign({}, ...args);
      // TODO we should do full state validation here
    return new QuerySettingsStore(this, updates);
  }
}
