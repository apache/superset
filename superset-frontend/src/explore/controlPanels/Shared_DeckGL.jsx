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
import { D3_FORMAT_OPTIONS } from '../controls';

const timeColumnOption = {
  verbose_name: 'Time',
  column_name: '__timestamp',
  description: t(
    'A reference to the [Time] configuration, taking granularity into ' +
      'account',
  ),
};

const groupByControl = {
  type: 'SelectControl',
  multi: true,
  freeForm: true,
  label: t('Group by'),
  default: [],
  includeTime: false,
  description: t('One or many controls to group by'),
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
        newState.options.push(timeColumnOption);
      }
    }
    return newState;
  },
  commaChoosesOption: false,
};

const sandboxUrl =
  'https://github.com/apache/incubator-superset/' +
  'blob/master/superset-frontend/src/modules/sandbox.js';
const jsFunctionInfo = (
  <div>
    {t(
      'For more information about objects are in context in the scope of this function, refer to the',
    )}
    <a href={sandboxUrl}>{t(" source code of Superset's sandboxed parser")}.</a>
    .
  </div>
);

function jsFunctionControl(
  label,
  description,
  extraDescr = null,
  height = 100,
  defaultText = '',
) {
  return {
    type: 'TextAreaControl',
    language: 'javascript',
    label,
    description,
    height,
    default: defaultText,
    aboveEditorSection: (
      <div>
        <p>{description}</p>
        <p>{jsFunctionInfo}</p>
        {extraDescr}
      </div>
    ),
    mapStateToProps: state => ({
      warning: !state.common.conf.ENABLE_JAVASCRIPT_CONTROLS
        ? t(
            'This functionality is disabled in your environment for security reasons.',
          )
        : null,
      readOnly: !state.common.conf.ENABLE_JAVASCRIPT_CONTROLS,
    }),
  };
}

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
    ...groupByControl,
    label: t('Dimension'),
    description: t('Select a dimension'),
    multi: false,
    default: null,
  },
};

export const jsColumns = {
  name: 'js_columns',
  config: {
    ...groupByControl,
    label: t('Extra data for JS'),
    default: [],
    description: t(
      'List of extra columns made available in Javascript functions',
    ),
  },
};

export const jsDataMutator = {
  name: 'js_data_mutator',
  config: jsFunctionControl(
    t('Javascript data interceptor'),
    t(
      'Define a javascript function that receives the data array used in the visualization ' +
        'and is expected to return a modified version of that array. This can be used ' +
        'to alter properties of the data, filter, or enrich the array.',
    ),
  ),
};

export const jsTooltip = {
  name: 'js_tooltip',
  config: jsFunctionControl(
    t('Javascript tooltip generator'),
    t(
      'Define a function that receives the input and outputs the content for a tooltip',
    ),
  ),
};

export const jsOnclickHref = {
  name: 'js_onclick_href',
  config: jsFunctionControl(
    t('Javascript onClick href'),
    t('Define a function that returns a URL to navigate to when user clicks'),
  ),
};

export const legendFormat = {
  name: 'legend_format',
  config: {
    label: t('Legend Format'),
    description: t('Choose the format for legend values'),
    type: 'SelectControl',
    clearable: false,
    default: D3_FORMAT_OPTIONS[0],
    choices: D3_FORMAT_OPTIONS,
    renderTrigger: true,
  },
};

export const legendPosition = {
  name: 'legend_position',
  config: {
    label: t('Legend Position'),
    description: t('Choose the position of the legend'),
    type: 'SelectControl',
    clearable: false,
    default: 'tr',
    choices: [
      [null, 'None'],
      ['tl', 'Top left'],
      ['tr', 'Top right'],
      ['bl', 'Bottom left'],
      ['br', 'Bottom right'],
    ],
    renderTrigger: true,
  },
};
