import {
  CHART_TYPE,
  COLUMN_TYPE,
  DIVIDER_TYPE,
  HEADER_TYPE,
  INVISIBLE_ROW_TYPE,
  ROW_TYPE,
  SPACER_TYPE,
  TAB_TYPE,
  TABS_TYPE,
} from '../../util/componentTypes';

import Chart from './Chart';
import Column from './Column';
import Divider from './Divider';
import Header from './Header';
import Row from './Row';
import Spacer from './Spacer';
import Tab from './Tab';
import Tabs from './Tabs';

export { default as Chart } from './Chart';
export { default as Column } from './Column';
export { default as Divider } from './Divider';
export { default as Header } from './Header';
export { default as Row } from './Row';
export { default as Spacer } from './Spacer';
export { default as Tab } from './Tab';
export { default as Tabs } from './Tabs';

export default {
  [CHART_TYPE]: Chart,
  [COLUMN_TYPE]: Column,
  [DIVIDER_TYPE]: Divider,
  [HEADER_TYPE]: Header,
  [INVISIBLE_ROW_TYPE]: Row,
  [ROW_TYPE]: Row,
  [SPACER_TYPE]: Spacer,
  [TAB_TYPE]: Tab,
  [TABS_TYPE]: Tabs,
};
