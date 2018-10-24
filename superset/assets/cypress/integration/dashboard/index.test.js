import DashboardControlsTest from './controls';
import DashboardEditModeTest from './edit_mode';
import DashboardFavStarTest from './fav_star';
import DashboardFilterTest from './filter';
import DashboardLoadTest from './load';

describe('Dashboard', () => {
  DashboardControlsTest();
  DashboardEditModeTest();
  DashboardFavStarTest();
  DashboardFilterTest();
  DashboardLoadTest();
});
