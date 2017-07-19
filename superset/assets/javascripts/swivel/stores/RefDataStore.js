export default class RefDataStore {
  constructor(...data) {
        // Dynamic ref data
    this.datasources = [];
    this.columns = [];
    this.metrics = [];
    this.timeGrains = [];
        // Static ref data
    this.viz_types = [
            { id: 'table', name: 'Table' },
            { id: 'line', name: 'Line Chart' },
            { id: 'bar', name: 'Bar Chart' },
            { id: 'area', name: 'Area Chart' },
    ];
    this.update(...data);
  }

  update(...data) {
    Object.assign(this, ...data);
  }
}
