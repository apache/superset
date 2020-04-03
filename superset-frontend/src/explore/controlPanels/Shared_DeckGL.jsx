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

// These are control configurations that are shared ONLY within the DeckGL viz plugin repo.

import React from 'react';
import { t } from '@superset-ui/translation';
import ColumnOption from '../../components/ColumnOption';

export const filterNulls = {
  name: 'filter_nulls',
  config: {
    type: 'CheckboxControl',
    label: t('Ignore null locations'),
    default: true,
    description: t('Whether to ignore locations that are null'),
  },
};

export const autozoom = {
  name: 'autozoom',
  config: {
    type: 'CheckboxControl',
    label: t('Auto Zoom'),
    default: true,
    renderTrigger: true,
    description: t(
      'When checked, the map will zoom to your data after each query',
    ),
  },
};

export const dimension = {
  name: 'dimension',
  config: {
    type: 'SelectControl',
    multi: false,
    freeForm: true,
    label: t('Dimension'),
    default: null,
    includeTime: false,
    description: t('Select a dimension'),
    optionRenderer: c => <ColumnOption column={c} showType />,
    valueRenderer: c => <ColumnOption column={c} />,
    valueKey: 'column_name',
    allowAll: true,
    filterOption: (opt, text) =>
      (opt.column_name &&
        opt.column_name.toLowerCase().indexOf(text.toLowerCase()) >= 0) ||
      (opt.verbose_name &&
        opt.verbose_name.toLowerCase().indexOf(text.toLowerCase()) >= 0),
    promptTextCreator: label => label,
    mapStateToProps: (state, control) => {
      const newState = {};
      if (state.datasource) {
        newState.options = state.datasource.columns.filter(c => c.groupby);
        if (control && control.includeTime) {
          newState.options.push({
            verbose_name: 'Time',
            column_name: '__timestamp',
            description: t(
              'A reference to the [Time] configuration, taking granularity into ' +
                'account',
            ),
          });
        }
      }
      return newState;
    },
    commaChoosesOption: false,
  },
};
