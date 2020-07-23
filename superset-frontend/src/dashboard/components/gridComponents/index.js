/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import {
  CHART_TYPE,
  MARKDOWN_TYPE,
  COLUMN_TYPE,
  DIVIDER_TYPE,
  HEADER_TYPE,
  ROW_TYPE,
  TAB_TYPE,
  TABS_TYPE,
} from '../../util/componentTypes';

import ChartHolder from './ChartHolder';
import Markdown from './Markdown';
import Column from './Column';
import Divider from './Divider';
import Header from './Header';
import Row from './Row';
import Tab from './Tab';
import Tabs from './Tabs';

export { default as ChartHolder } from './ChartHolder';
export { default as Markdown } from './Markdown';
export { default as Column } from './Column';
export { default as Divider } from './Divider';
export { default as Header } from './Header';
export { default as Row } from './Row';
export { default as Tab } from './Tab';
export { default as Tabs } from './Tabs';

export default {
  [CHART_TYPE]: ChartHolder,
  [MARKDOWN_TYPE]: Markdown,
  [COLUMN_TYPE]: Column,
  [DIVIDER_TYPE]: Divider,
  [HEADER_TYPE]: Header,
  [ROW_TYPE]: Row,
  [TAB_TYPE]: Tab,
  [TABS_TYPE]: Tabs,
};
