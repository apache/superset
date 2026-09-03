/* eslint-disable camelcase */
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 */

import {
  ControlPanelConfig,
  ControlPanelsContainerProps,
  ControlState,
  CustomControlItem,
} from '@superset-ui/chart-controls';
import { QueryMode } from '@superset-ui/core';
import config from '../src/controlPanel';

type VisibilityFn = (
  props: ControlPanelsContainerProps,
  control?: ControlState,
) => boolean;

function isControlWithVisibility(
  controlItem: unknown,
): controlItem is CustomControlItem & {
  config: Required<CustomControlItem['config']> & { visibility: VisibilityFn };
} {
  return (
    typeof controlItem === 'object' &&
    controlItem !== null &&
    'name' in controlItem &&
    'config' in controlItem &&
    typeof (controlItem as CustomControlItem).config?.visibility === 'function'
  );
}

function getVisibility(
  panel: ControlPanelConfig,
  controlName: string,
): VisibilityFn {
  const item = (panel.controlPanelSections || [])
    .flatMap(section => section?.controlSetRows || [])
    .flat()
    .find(c => isControlWithVisibility(c) && c.name === controlName);

  if (!isControlWithVisibility(item)) {
    throw new Error(`Control "${controlName}" with visibility not found`);
  }
  return item.config.visibility;
}

function mkProps(
  groupbyValue: string[],
  options = [
    { column_name: 'ORDERDATE', is_dttm: true },
    { column_name: 'some_other_col', is_dttm: false },
  ],
  queryMode?: QueryMode,
): ControlPanelsContainerProps {
  return {
    controls: {
      groupby: { value: groupbyValue, options },
      ...(queryMode ? { query_mode: { value: queryMode } } : {}),
    },
  } as unknown as ControlPanelsContainerProps;
}

test('time_grain_sqla visibility should be case-insensitive', () => {
  const vis = getVisibility(config, 'time_grain_sqla');
  const controlState = {} as ControlState;

  expect(vis(mkProps(['orderdate']), controlState)).toBe(true);
  expect(vis(mkProps(['ORDERDATE']), controlState)).toBe(true);
  expect(vis(mkProps(['some_other_col']), controlState)).toBe(false);
});

test('time_grain_sqla visibility is false in raw records mode even with a stale temporal groupby value', () => {
  const vis = getVisibility(config, 'time_grain_sqla');
  const controlState = {} as ControlState;

  // Simulates switching from an aggregated Line chart (groupby set to a
  // temporal column) to Table's Raw Records mode: groupby's value survives
  // the switch (its own visibility uses resetOnHide: false), but the query
  // is no longer aggregated, so time_grain_sqla must not stay visible/applied.
  expect(
    vis(mkProps(['orderdate'], undefined, QueryMode.Raw), controlState),
  ).toBe(false);
});

test('time_grain_sqla visibility still requires aggregate mode plus a temporal groupby column', () => {
  const vis = getVisibility(config, 'time_grain_sqla');
  const controlState = {} as ControlState;

  expect(
    vis(mkProps(['orderdate'], undefined, QueryMode.Aggregate), controlState),
  ).toBe(true);
  expect(
    vis(
      mkProps(['some_other_col'], undefined, QueryMode.Aggregate),
      controlState,
    ),
  ).toBe(false);
});
