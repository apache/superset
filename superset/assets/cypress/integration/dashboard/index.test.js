import DashboardControlsTest from './controls';
import DashboardEditModeTest from './edit_mode';
import DashboardFilterTest from './filter';
import DashboardLoadTest from './load';

describe('Dashboard', () => {
  DashboardControlsTest();
  DashboardEditModeTest();
  DashboardFilterTest();
  DashboardLoadTest();
});
