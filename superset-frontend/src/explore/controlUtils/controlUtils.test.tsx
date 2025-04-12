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
  DatasourceType,
  getChartControlPanelRegistry,
  t,
  VizType,
} from '@superset-ui/core';
import {
  ControlConfig,
  ControlPanelState,
  CustomControlItem,
} from '@superset-ui/chart-controls';
import {
  getControlConfig,
  getControlState,
  applyMapStateToPropsToControl,
  findControlItem,
} from 'src/explore/controlUtils';
import {
  controlPanelSectionsChartOptions,
  controlPanelSectionsChartOptionsOnlyColorScheme,
  controlPanelSectionsChartOptionsTable,
} from 'src/explore/fixtures';

const getKnownControlConfig = (controlKey: string, vizType: string) =>
  getControlConfig(controlKey, vizType) as ControlConfig;

const getKnownControlState = (...args: Parameters<typeof getControlState>) =>
  getControlState(...args) as Exclude<ReturnType<typeof getControlState>, null>;

describe('controlUtils', () => {
  const state: ControlPanelState = {
    datasource: {
      id: 1,
      type: DatasourceType.Table,
      columns: [{ column_name: 'a' }],
      metrics: [{ metric_name: 'first' }, { metric_name: 'second' }],
      column_formats: {},
      currency_formats: {},
      verbose_map: {},
      main_dttm_col: '',
      datasource_name: '1__table',
      description: null,
    },
    controls: {},
    form_data: { datasource: '1__table', viz_type: VizType.Table },
    common: {},
    slice: {
      slice_id: 1,
    },
  };

  beforeAll(() => {
    getChartControlPanelRegistry()
      .registerValue('test-chart', {
        controlPanelSections: controlPanelSectionsChartOptions,
      })
      .registerValue('test-chart-override', {
        controlPanelSections: controlPanelSectionsChartOptionsOnlyColorScheme,
        controlOverrides: {
          color_scheme: {
            label: t('My beautiful colors'),
          },
        },
      })
      .registerValue('table', {
        controlPanelSections: controlPanelSectionsChartOptionsTable,
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
      expect(spatialControl?.type).toEqual('ColorSchemeControl');
    });

    it('overrides according to vizType', () => {
      let control = getKnownControlConfig('color_scheme', 'test-chart');
      expect(control.label).toEqual('Color Scheme');

      control = getKnownControlConfig('color_scheme', 'test-chart-override');
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
      let control = getKnownControlConfig('all_columns', 'table');
      control = applyMapStateToPropsToControl(control, state);
      expect(control.options).toEqual([{ column_name: 'a' }]);
    });
  });

  describe('getControlState', () => {
    it('to still have the functions', () => {
      const control = getKnownControlState('metrics', 'table', state, 'a');
      expect(typeof control.mapStateToProps).toBe('function');
      expect(typeof control.validators?.[0]).toBe('function');
    });

    it('to make sure value is array', () => {
      const control = getKnownControlState('all_columns', 'table', state, 'a');
      expect(control.value).toEqual(['a']);
    });

    it('removes missing/invalid choice', () => {
      let control = getControlState(
        'stacked_style',
        'test-chart',
        state,
        'stack',
      );
      expect(control?.value).toBe('stack');

      control = getControlState('stacked_style', 'test-chart', state, 'FOO');
      expect(control?.value).toBeNull();
    });

    it('returns null for nonexistent field', () => {
      const control = getControlState('NON_EXISTENT', 'table', state);
      expect(control).toBeNull();
    });

    it('metrics control should be empty by default', () => {
      const control = getControlState('metrics', 'table', state);
      expect(control?.default).toBeUndefined();
    });

    it('metric control should be empty by default', () => {
      const control = getControlState('metric', 'table', state);
      expect(control?.default).toBeUndefined();
    });

    it('should not apply mapStateToProps when initializing', () => {
      const control = getControlState('metrics', 'table', {
        ...state,
        controls: undefined,
      });
      expect(control?.value).toBe(undefined);
    });
  });

  describe('validateControl', () => {
    it('validates the control, returns an error if empty', () => {
      const control = getControlState('metric', 'table', state, null);
      expect(control?.validationErrors).toEqual(['cannot be empty']);
    });
    it('should not validate if control panel is initializing', () => {
      const control = getControlState(
        'metric',
        'table',
        { ...state, controls: undefined },
        undefined,
      );
      expect(control?.validationErrors).toBeUndefined();
    });
  });

  describe('findControlItem', () => {
    it('find control as a string', () => {
      const controlItem = findControlItem(
        controlPanelSectionsChartOptions,
        'color_scheme',
      );
      expect(controlItem).toEqual('color_scheme');
    });

    it('find control as a control object', () => {
      let controlItem = findControlItem(
        controlPanelSectionsChartOptions,
        'rose_area_proportion',
      ) as CustomControlItem;
      expect(controlItem.name).toEqual('rose_area_proportion');
      expect(controlItem).toHaveProperty('config');

      controlItem = findControlItem(
        controlPanelSectionsChartOptions,
        'stacked_style',
      ) as CustomControlItem;
      expect(controlItem.name).toEqual('stacked_style');
      expect(controlItem).toHaveProperty('config');
    });

    it('returns null when key is not found', () => {
      const controlItem = findControlItem(
        controlPanelSectionsChartOptions,
        'non_existing_key',
      );
      expect(controlItem).toBeNull();
    });
  });
});
