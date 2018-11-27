import DashboardControlsTest from './controls';
import DashboardEditModeTest from './edit_mode';
import DashboardFavStarTest from './fav_star';
import DashboardFilterTest from './filter';
import DashboardLoadTest from './load';
import DashboardSaveTest from './save';

describe('Dashboard', () => {
  DashboardControlsTest();
  DashboardEditModeTest();
  DashboardFavStarTest();
  DashboardFilterTest();
  DashboardLoadTest();
  DashboardSaveTest();
});
