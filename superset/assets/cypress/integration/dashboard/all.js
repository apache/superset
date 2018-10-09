import DashboardControlsTest from './_controls';
import DashboardEditModeTest from './_edit_mode';
import DashboardFilterTest from './_filter';
import DashboardLoadTest from './_load';

describe('Dashboard', () => {
  DashboardControlsTest();
  DashboardEditModeTest();
  DashboardFilterTest();
  DashboardLoadTest();
});
