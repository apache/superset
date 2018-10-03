import queryTests from './_query';
import sourcePanelTests from './_sourcePanel';
import tabsTests from './_tabs';

describe('All SqlLab tests', () => {
  queryTests();
  sourcePanelTests();
  tabsTests();
});
