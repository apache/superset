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
  ControlPanelConfig,
  emitFilterControl,
  sections,
} from '@superset-ui/chart-controls';
import { addLocaleData, t } from '@superset-ui/core';
import i18n from '../i18n';
import { allColumnsControlSetItem } from './controls/columns';
import { groupByControlSetItem } from './controls/groupBy';
import { handlebarsTemplateControlSetItem } from './controls/handlebarTemplate';
import { includeTimeControlSetItem } from './controls/includeTime';
import {
  rowLimitControlSetItem,
  timeSeriesLimitMetricControlSetItem,
} from './controls/limits';
import {
  metricsControlSetItem,
  percentMetricsControlSetItem,
  showTotalsControlSetItem,
} from './controls/metrics';
import {
  orderByControlSetItem,
  orderDescendingControlSetItem,
} from './controls/orderBy';
import {
  serverPageLengthControlSetItem,
  serverPaginationControlSetRow,
} from './controls/pagination';
import { queryModeControlSetItem } from './controls/queryMode';
import { styleControlSetItem } from './controls/style';

addLocaleData(i18n);

const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.legacyTimeseriesTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [queryModeControlSetItem],
        [groupByControlSetItem],
        [metricsControlSetItem, allColumnsControlSetItem],
        [percentMetricsControlSetItem],
        [timeSeriesLimitMetricControlSetItem, orderByControlSetItem],
        serverPaginationControlSetRow,
        [rowLimitControlSetItem, serverPageLengthControlSetItem],
        [includeTimeControlSetItem, orderDescendingControlSetItem],
        [showTotalsControlSetItem],
        ['adhoc_filters'],
        emitFilterControl,
      ],
    },
    {
      label: t('Options'),
      expanded: true,
      controlSetRows: [
        [handlebarsTemplateControlSetItem],
        [styleControlSetItem],
      ],
    },
  ],
};

export default config;
