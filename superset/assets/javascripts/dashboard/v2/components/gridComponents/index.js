import {
  CHART_TYPE,
  COLUMN_TYPE,
  DIVIDER_TYPE,
  HEADER_TYPE,
  INVISIBLE_ROW_TYPE,
  ROW_TYPE,
  TAB_TYPE,
  TABS_TYPE,
} from '../../util/componentTypes';

import ChartHolder from './ChartHolder';
import Column from './Column';
import Divider from './Divider';
import Header from './Header';
import Row from './Row';
import Tab from './Tab';
import Tabs from './Tabs';

export { default as ChartHolder } from './ChartHolder';
export { default as Column } from './Column';
export { default as Divider } from './Divider';
export { default as Header } from './Header';
export { default as Row } from './Row';
export { default as Tab } from './Tab';
export { default as Tabs } from './Tabs';

export default {
  [CHART_TYPE]: ChartHolder,
  [COLUMN_TYPE]: Column,
  [DIVIDER_TYPE]: Divider,
  [HEADER_TYPE]: Header,
  [INVISIBLE_ROW_TYPE]: Row,
  [ROW_TYPE]: Row,
  [TAB_TYPE]: Tab,
  [TABS_TYPE]: Tabs,
};
