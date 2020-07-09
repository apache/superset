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

import React from 'react';
import { getChartControlPanelRegistry } from '@superset-ui/chart';
import { t } from '@superset-ui/translation';
import { ColumnOption } from '@superset-ui/chart-controls';
import {
  getControlConfig,
  getControlState,
  getFormDataFromControls,
  applyMapStateToPropsToControl,
  getAllControlsState,
} from 'src/explore/controlUtils';

describe('controlUtils', () => {
  const state = {
    datasource: {
      columns: ['a', 'b', 'c'],
      metrics: [{ metric_name: 'first' }, { metric_name: 'second' }],
    },
  };

  beforeAll(() => {
    getChartControlPanelRegistry()
      .registerValue('test-chart', {
        controlPanelSections: [
          {
            label: t('Chart Options'),
            expanded: true,
            controlSetRows: [
              [
                'color_scheme',
                {
                  name: 'rose_area_proportion',
                  config: {
                    type: 'CheckboxControl',
                    label: t('Use Area Proportions'),
                    description: t(
                      'Check if the Rose Chart should use segment area instead of ' +
                        'segment radius for proportioning',
                    ),
                    default: false,
                    renderTrigger: true,
                  },
                },
              ],
              [
                {
                  name: 'stacked_style',
                  config: {
                    type: 'SelectControl',
                    label: t('Stacked Style'),
                    renderTrigger: true,
                    choices: [
                      ['stack', 'stack'],
                      ['stream', 'stream'],
                      ['expand', 'expand'],
                    ],
                    default: 'stack',
                    description: '',
                  },
                },
              ],
            ],
          },
        ],
      })
      .registerValue('test-chart-override', {
        controlPanelSections: [
          {
            label: t('Chart Options'),
            expanded: true,
            controlSetRows: [['color_scheme']],
          },
        ],
        controlOverrides: {
          color_scheme: {
            label: t('My beautiful colors'),
          },
        },
      })
      .registerValue('table', {
        controlPanelSections: [
          {
            label: t('Chart Options'),
            expanded: true,
            controlSetRows: [
              [
                'metric',
                'metrics',
                {
                  name: 'all_columns',
                  config: {
                    type: 'SelectControl',
                    queryField: 'columns',
                    multi: true,
                    label: t('Columns'),
                    default: [],
                    description: t('Columns to display'),
                    optionRenderer: c => <ColumnOption column={c} showType />,
                    valueRenderer: c => <ColumnOption column={c} />,
                    valueKey: 'column_name',
                    allowAll: true,
                    mapStateToProps: stateRef => ({
                      options: stateRef.datasource
                        ? stateRef.datasource.columns
                        : [],
                    }),
                    commaChoosesOption: false,
                    freeForm: true,
                  },
                },
              ],
            ],
          },
        ],
      });
  });

  afterAll(() => {
    getChartControlPanelRegistry()
      .remove('test-chart')
      .remove('test-chart-override');
  });

  describe('getControlConfig', () => {
    it('returns a valid spatial controlConfig', () => {
      const spatialControl = getControlConfig('color_scheme', 'test-chart');
      expect(spatialControl.type).toEqual('ColorSchemeControl');
    });

    it('overrides according to vizType', () => {
      let control = getControlConfig('color_scheme', 'test-chart');
      expect(control.label).toEqual('Color Scheme');

      // deck_polygon overrides and removes validators
      control = getControlConfig('color_scheme', 'test-chart-override');
      expect(control.label).toEqual('My beautiful colors');
    });

    it(
      'returns correct control config when control config is defined ' +
        'in the control panel definition',
      () => {
        const roseAreaProportionControlConfig = getControlConfig(
          'rose_area_proportion',
          'test-chart',
        );
        expect(roseAreaProportionControlConfig).toEqual({
          type: 'CheckboxControl',
          label: t('Use Area Proportions'),
          description: t(
            'Check if the Rose Chart should use segment area instead of ' +
              'segment radius for proportioning',
          ),
          default: false,
          renderTrigger: true,
        });
      },
    );
  });

  describe('applyMapStateToPropsToControl,', () => {
    it('applies state to props as expected', () => {
      let control = getControlConfig('all_columns', 'table');
      control = applyMapStateToPropsToControl(control, state);
      expect(control.options).toEqual(['a', 'b', 'c']);
    });

    it('removes the mapStateToProps key from the object', () => {
      let control = getControlConfig('all_columns', 'table');
      control = applyMapStateToPropsToControl(control, state);
      expect(control.mapStateToProps[0]).toBe(undefined);
    });
  });

  describe('getControlState', () => {
    it('to still have the functions', () => {
      const control = getControlState('metrics', 'table', state, ['a']);
      expect(typeof control.mapStateToProps).toBe('function');
      expect(typeof control.validators[0]).toBe('function');
    });

    it('to fix multi with non-array values', () => {
      const control = getControlState('all_columns', 'table', state, 'a');
      expect(control.value).toEqual(['a']);
    });

    it('removes missing/invalid choice', () => {
      let control = getControlState(
        'stacked_style',
        'test-chart',
        state,
        'stack',
      );
      expect(control.value).toBe('stack');

      control = getControlState('stacked_style', 'test-chart', state, 'FOO');
      expect(control.value).toBeNull();
    });

    it('returns null for non-existent field', () => {
      const control = getControlState('NON_EXISTENT', 'table', state);
      expect(control).toBeNull();
    });

    it('applies the default function for metrics', () => {
      const control = getControlState('metrics', 'table', state);
      expect(control.default).toEqual(['first']);
    });

    it('applies the default function for metric', () => {
      const control = getControlState('metric', 'table', state);
      expect(control.default).toEqual('first');
    });

    it('applies the default function, prefers count if it exists', () => {
      const stateWithCount = {
        ...state,
        datasource: {
          ...state.datasource,
          metrics: [
            { metric_name: 'first' },
            { metric_name: 'second' },
            { metric_name: 'count' },
          ],
        },
      };
      const control = getControlState('metrics', 'table', stateWithCount);
      expect(control.default).toEqual(['count']);
    });
  });

  describe('validateControl', () => {
    it('validates the control, returns an error if empty', () => {
      const control = getControlState('metric', 'table', state, null);
      expect(control.validationErrors).toEqual(['cannot be empty']);
    });
  });

  describe('queryFields', () => {
    it('in formData', () => {
      const controlsState = getAllControlsState('table', 'table', {}, {});
      const formData = getFormDataFromControls(controlsState);
      expect(formData.queryFields).toEqual({
        all_columns: 'columns',
        metric: 'metrics',
        metrics: 'metrics',
      });
    });
  });
});
