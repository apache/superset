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
  BaseControlConfig,
  ControlType,
  ControlPanelsContainerProps,
  ControlPanelState,
  ControlSetItem,
  ControlState,
  isCustomControlItem,
  sharedControls,
} from '@superset-ui/chart-controls';
import { QueryMode } from '@superset-ui/core';
import config from '../src/controlPanel';

function resolveControl(
  item: ControlSetItem,
): BaseControlConfig<ControlType> | undefined {
  if (typeof item === 'string') return sharedControls[item];
  if (!item || !('name' in item)) return undefined;
  return {
    ...sharedControls[item.name],
    ...(isCustomControlItem(item) ? item.config : {}),
    ...(!isCustomControlItem(item) && 'override' in item ? item.override : {}),
  };
}

function state(mode: QueryMode, serverPagination: boolean) {
  return {
    controls: {
      query_mode: { value: mode },
      server_pagination: { value: serverPagination },
      groupby: { value: ['name'], options: [] },
      metrics: { value: ['count'] },
      percent_metrics: { value: [] },
      all_columns: { value: ['name'] },
      time_compare: { value: [] },
    },
    form_data: { query_mode: mode },
    datasource: { columns: [] },
  } as unknown as ControlPanelsContainerProps & ControlPanelState;
}

function findControl(name: string): BaseControlConfig<ControlType> {
  for (const section of config.controlPanelSections) {
    if (!section) continue;
    for (const item of section.controlSetRows.flat()) {
      if (isCustomControlItem(item) && item.name === name) {
        return resolveControl(item)!;
      }
    }
  }
  throw new Error(`Missing ${name}`);
}

test.each([QueryMode.Aggregate, QueryMode.Raw])(
  '%s visible controls and sections with pagination on/off',
  mode => {
    for (const serverPagination of [false, true]) {
      const props = state(mode, serverPagination);
      const visible = config.controlPanelSections
        .filter(section => section !== null)
        .filter(
          section => section.visibility?.(props, {} as ControlState) !== false,
        )
        .map(section => ({
          label: section.label,
          visible: section.visibility?.(props, {} as ControlState) ?? true,
          controls: section.controlSetRows.flat().flatMap(item => {
            if (!item) return [];
            const name =
              typeof item === 'string' ? item : 'name' in item ? item.name : '';
            const control = resolveControl(item);
            if (
              !control ||
              control.hidden ||
              control.visibility?.(props, {} as ControlState) === false
            )
              return [];
            return [name];
          }),
        }));
      expect({ mode, serverPagination, visible }).toMatchSnapshot();
    }
    expect(findControl('server_page_length').label).toBe('Server Page Length');
    expect(findControl('server_page_length').default).toBe(10);
    expect(findControl('row_limit').default).toBe(10000);
  },
);

test.each([QueryMode.Aggregate, QueryMode.Raw])(
  '%s radio offers exactly Aggregate and Raw records with flags off',
  mode => {
    const control = findControl('query_mode');
    const mapped = control.mapStateToProps?.(
      state(mode, false),
      {} as ControlState,
      { queriesResponse: null },
    );
    expect(mapped?.options ?? control.options).toEqual([
      ['aggregate', 'Aggregate'],
      ['raw', 'Raw records'],
    ]);
  },
);
