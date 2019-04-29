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
  getControlConfig,
  getControlState,
  getControlKeys,
  applyMapStateToPropsToControl,
} from '../../../src/explore/controlUtils';

describe('controlUtils', () => {
  const state = {
    datasource: {
      columns: [
        'a', 'b', 'c',
      ],
      metrics: [
        { metric_name: 'first' },
        { metric_name: 'second' },
      ],
    },
  };

  describe('getControlConfig', () => {
    it('returns a valid spatial controlConfig', () => {
      const spatialControl = getControlConfig('spatial', 'deck_grid');
      expect(spatialControl.type).toEqual('SpatialControl');
      expect(spatialControl.validators).toHaveLength(1);
    });
    it('overrides according to vizType', () => {
      let control = getControlConfig('metric', 'line');
      expect(control.type).toEqual('MetricsControl');
      expect(control.validators).toHaveLength(1);

      // deck_polygon overrides and removes validators
      control = getControlConfig('metric', 'deck_polygon');
      expect(control.type).toEqual('MetricsControl');
      expect(control.validators).toHaveLength(0);
    });
  });

  describe('getControlKeys', () => {

    window.featureFlags = {
      SCOPED_FILTER: false,
    };

    it('gets only strings, even when React components are in conf', () => {
      const keys = getControlKeys('filter_box');
      expect(keys.every(k => typeof k === 'string')).toEqual(true);
      expect(keys).toHaveLength(16);
    });
    it('gets the right set of controlKeys for filter_box', () => {
      const keys = getControlKeys('filter_box');
      expect(keys.sort()).toEqual([
        'adhoc_filters',
        'cache_timeout',
        'datasource',
        'date_filter',
        'druid_time_origin',
        'filter_configs',
        'granularity',
        'instant_filtering',
        'show_druid_time_granularity',
        'show_druid_time_origin',
        'show_sqla_time_column',
        'show_sqla_time_granularity',
        'slice_id',
        'time_range',
        'url_params',
        'viz_type',
      ]);
    });
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
      expect(control.mapStateToProps).toBe(undefined);
    });

  });

  describe('getControlState', () => {

    it('to be function free', () => {
      const control = getControlState('all_columns', 'table', state, ['a']);
      expect(control.mapStateToProps).toBe(undefined);
      expect(control.validators).toBe(undefined);
    });

    it('to fix multi with non-array values', () => {
      const control = getControlState('all_columns', 'table', state, 'a');
      expect(control.value).toEqual(['a']);
    });

    it('removes missing/invalid choice', () => {
      let control = getControlState('stacked_style', 'area', state, 'stack');
      expect(control.value).toBe('stack');

      control = getControlState('stacked_style', 'area', state, 'FOO');
      expect(control.value).toBe(null);
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

});
