export default class VizSettingsStore {
  constructor(...data) {
    this.title = '';
    this.showLegend = false;
    this.richTooltip = true;
    this.separateCharts = false;

    this.update(...data);
  }

  update(...data) {
    Object.assign(this, ...data);
  }
}
