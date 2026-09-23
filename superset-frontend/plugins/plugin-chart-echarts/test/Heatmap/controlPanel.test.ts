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
import type {
  ControlPanelConfig,
  ControlPanelSectionConfig,
  CustomControlItem,
} from '@superset-ui/chart-controls';
import { applyMapStateToPropsToControl } from 'src/explore/controlUtils/getControlState';
import controlPanel from '../../src/Heatmap/controlPanel';

type ControlConfig = Required<CustomControlItem['config']>;

function isCustomControlItem(
  controlItem: unknown,
): controlItem is CustomControlItem & { config: ControlConfig } {
  return (
    typeof controlItem === 'object' &&
    controlItem !== null &&
    'name' in controlItem &&
    'config' in controlItem
  );
}

function getControl(
  panel: ControlPanelConfig,
  controlName: string,
): CustomControlItem & { config: ControlConfig } {
  const item = (panel.controlPanelSections || [])
    .flatMap(
      (section: ControlPanelSectionConfig | null | undefined) =>
        section?.controlSetRows || [],
    )
    .flat()
    .find(
      (controlItem: unknown) =>
        isCustomControlItem(controlItem) && controlItem.name === controlName,
    );

  if (!isCustomControlItem(item)) {
    throw new Error(`Control "${controlName}" not found`);
  }

  return item;
}

test('Sort Y Axis defaults to ascending; Sort X Axis has no default', () => {
  // The Y-axis groupby dimension has no natural ordering to fall back on
  // (unlike a typically-temporal X-axis), so a brand-new chart defaults it
  // to ascending sort. See RCA in the "reproduces the reported bug" test
  // below, and Heatmap/transformProps.test.ts for how this value is
  // consumed once it reaches transformProps.
  expect(getControl(controlPanel, 'sort_y_axis').config.default).toBe(
    'alpha_asc',
  );
  // Left deliberately unset: an X-axis is often a temporal/time-grain
  // column that already arrives from the backend in chronological order,
  // and defaulting it to alphabetical sort risks reordering values that
  // aren't zero-padded/ISO-sortable strings (e.g. month names).
  expect(
    getControl(controlPanel, 'sort_x_axis').config.default,
  ).toBeUndefined();
  // Both remain clearable: a user can still explicitly opt out of sorting.
  expect(getControl(controlPanel, 'sort_y_axis').config.clearable).toBe(true);
  expect(getControl(controlPanel, 'sort_x_axis').config.clearable).toBe(true);
});

test('reproduces the reported bug: a brand-new chart resolves sort_y_axis to alpha_asc without the user touching the control', () => {
  const sortYAxisConfig = getControl(controlPanel, 'sort_y_axis').config;

  // A freshly created chart's control state starts with no persisted
  // value at all (the control was never rendered/touched before).
  const resolved = applyMapStateToPropsToControl(
    { ...sortYAxisConfig, value: undefined } as any,
    null,
  );

  expect(resolved.value).toBe('alpha_asc');
});

test('caveat: Superset cannot distinguish "explicitly cleared" from "never touched" once value is undefined, so re-editing a chart with sort_y_axis cleared also resolves the control back to alpha_asc', () => {
  // This is a pre-existing limitation of getControlState's default
  // application (`state.default != null && value == null`), not
  // something introduced by defaulting sort_y_axis specifically: any
  // clearable SelectControl with a `default` behaves this way, because
  // an explicit clear action (SelectControl's onChange(undefined) via
  // rc-select's triggerChange) is indistinguishable from an absent
  // value once it reaches getControlState. It only affects the Explore
  // editing session for this control -- it does NOT affect how already
  // -saved/dashboard-rendered charts render, since those call
  // transformProps directly on persisted formData and never go through
  // this control-state machinery at all (see the reverted fallback in
  // transformProps.ts and its accompanying commit message).
  const sortYAxisConfig = getControl(controlPanel, 'sort_y_axis').config;

  const explicitlyCleared = applyMapStateToPropsToControl(
    { ...sortYAxisConfig, value: undefined } as any,
    null,
  );

  expect(explicitlyCleared.value).toBe('alpha_asc');
});
