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
  FeatureFlag,
  isFeatureEnabled,
  t,
  validateNonEmpty,
} from '@superset-ui/core';
import { ControlPanelState, ControlState } from '../types';

export const xAxisControlConfig = {
  label: (state: ControlPanelState) => {
    if (
      isFeatureEnabled(FeatureFlag.GENERIC_CHART_AXES) &&
      state?.form_data?.orientation === 'horizontal'
    ) {
      return t('Y-axis');
    }

    return t('X-axis');
  },
  default: (
    control: ControlState,
    controlPanel: Partial<ControlPanelState>,
  ) => {
    // default to the chosen time column if x-axis is unset and the
    // GENERIC_CHART_AXES feature flag is enabled
    const { value } = control;
    if (value) {
      return value;
    }
    const timeColumn = controlPanel?.form_data?.granularity_sqla;
    if (isFeatureEnabled(FeatureFlag.GENERIC_CHART_AXES) && timeColumn) {
      return timeColumn;
    }
    return null;
  },
  multi: false,
  description: (state: ControlPanelState) => {
    if (
      isFeatureEnabled(FeatureFlag.GENERIC_CHART_AXES) &&
      state?.form_data?.orientation === 'horizontal'
    ) {
      return t('Dimension to use on y-axis.');
    }

    return t('Dimension to use on x-axis.');
  },
  validators: [validateNonEmpty],
};
