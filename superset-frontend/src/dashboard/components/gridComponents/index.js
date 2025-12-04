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
  BUTTON_TYPE,
  MODEL3D_TYPE,
  ALERTS_TYPE,
  ALERT_DATA_TABLE_TYPE,
  DYNAMIC_TYPE,
} from '../../util/componentTypes';

import ChartHolder from './ChartHolder';
import Markdown from './Markdown';
import Column from './Column';
import Divider from './Divider';
import Header from './Header';
import Row from './Row';
import Tab from './Tab';
import Tabs from './Tabs';
import Button from './Button';
import Model3D from './Model3D';
import Alerts from './Alerts';
import AlertDataTable from './AlertDataTable';
import DynamicComponent from './DynamicComponent';

export const componentLookup = {
  [CHART_TYPE]: ChartHolder,
  [MARKDOWN_TYPE]: Markdown,
  [COLUMN_TYPE]: Column,
  [DIVIDER_TYPE]: Divider,
  [HEADER_TYPE]: Header,
  [ROW_TYPE]: Row,
  [TAB_TYPE]: Tab,
  [TABS_TYPE]: Tabs,
  [BUTTON_TYPE]: Button,
  [MODEL3D_TYPE]: Model3D,
  [ALERTS_TYPE]: Alerts,
  [ALERT_DATA_TABLE_TYPE]: AlertDataTable,
  [DYNAMIC_TYPE]: DynamicComponent,
};
