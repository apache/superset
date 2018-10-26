import chartReducer, { chart } from '../../../src/chart/chartReducer';
import * as actions from '../../../src/chart/chartAction';


describe('chart reducers', () => {
  const chartKey = 1;
  let testChart;
  let charts;
  beforeEach(() => {
    testChart = {
      ...chart,
      id: chartKey,
    };
    charts = { [chartKey]: testChart };
  });

  it('should update endtime on fail', () => {
    const newState = chartReducer(charts, actions.chartUpdateStopped(chartKey));
    expect(newState[chartKey].chartUpdateEndTime).toBeGreaterThan(0);
    expect(newState[chartKey].chartStatus).toEqual('stopped');
  });

  it('should update endtime on timeout', () => {
    const newState = chartReducer(charts, actions.chartUpdateTimeout('timeout', 60, chartKey));
    expect(newState[chartKey].chartUpdateEndTime).toBeGreaterThan(0);
    expect(newState[chartKey].chartStatus).toEqual('failed');
  });
});
