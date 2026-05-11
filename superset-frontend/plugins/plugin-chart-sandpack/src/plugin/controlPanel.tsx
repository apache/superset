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
  getStandardizedControls,
} from '@superset-ui/chart-controls';
import { t } from '@apache-superset/core/translation';
import { appCodeControlSetItem } from './controls/appCode';
import { dependenciesControlSetItem } from './controls/dependencies';
import {
  layoutControlSetItem,
  showNavigatorControlSetItem,
  templateControlSetItem,
} from './controls/options';

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['groupby'],
        ['metrics'],
        ['adhoc_filters'],
        ['row_limit'],
      ],
    },
    {
      label: t('App'),
      expanded: true,
      controlSetRows: [
        [templateControlSetItem],
        [appCodeControlSetItem],
        [dependenciesControlSetItem],
      ],
    },
    {
      label: t('Display'),
      expanded: false,
      controlSetRows: [[layoutControlSetItem], [showNavigatorControlSetItem]],
    },
  ],
  formDataOverrides: formData => ({
    ...formData,
    groupby: getStandardizedControls().popAllColumns(),
    metrics: getStandardizedControls().popAllMetrics(),
  }),
};

export default config;
