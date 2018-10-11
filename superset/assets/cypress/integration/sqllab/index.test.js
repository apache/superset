import queryTests from './query';
import sourcePanelTests from './sourcePanel';
import tabsTests from './tabs';

describe('All SqlLab tests', () => {
  queryTests();
  sourcePanelTests();
  tabsTests();
});
