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
): ControlPanelsContainerProps {
  return {
    controls: {
      groupby: { value: groupbyValue, options },
    },
  } as unknown as ControlPanelsContainerProps;
}

function withControls(
  props: ControlPanelsContainerProps,
  controls: Record<string, unknown>,
): ControlPanelsContainerProps {
  return {
    ...props,
    controls: { ...props.controls, ...controls },
  } as unknown as ControlPanelsContainerProps;
}

test('time_grain_sqla visibility should be case-insensitive', () => {
  const vis = getVisibility(config, 'time_grain_sqla');
  const controlState = {} as ControlState;

  expect(vis(mkProps(['orderdate']), controlState)).toBe(true);
  expect(vis(mkProps(['ORDERDATE']), controlState)).toBe(true);
  expect(vis(mkProps(['some_other_col']), controlState)).toBe(false);
});

test('time_grain_sqla is hidden in raw records mode', () => {
  const vis = getVisibility(config, 'time_grain_sqla');
  const controlState = {} as ControlState;
  const temporalGroupby = mkProps(['ORDERDATE']);

  expect(
    vis(
      withControls(temporalGroupby, {
        query_mode: { value: QueryMode.Aggregate },
      }),
      controlState,
    ),
  ).toBe(true);

  // `groupby` is kept when the query mode switches to raw records, both in the
  // control state and in a saved chart's form data, so a temporal dimension on
  // its own must not bring the control back.
  expect(
    vis(
      withControls(temporalGroupby, { query_mode: { value: QueryMode.Raw } }),
      controlState,
    ),
  ).toBe(false);

  // Charts saved before the query mode control existed are inferred as raw
  // records from their columns.
  expect(
    vis(
      withControls(temporalGroupby, { all_columns: { value: ['name'] } }),
      controlState,
    ),
  ).toBe(false);
});

test('time_grain_sqla is hidden in raw records mode for an adhoc dimension', () => {
  const vis = getVisibility(config, 'time_grain_sqla');
  const controlState = {} as ControlState;

  // An adhoc column reports temporal without the lookup, so it needs the guard too.
  const adhocGroupby = withControls(mkProps([]), {
    groupby: {
      value: [{ sqlExpression: 'ds', label: 'ds', expressionType: 'SQL' }],
      options: [],
    },
  });

  expect(
    vis(
      withControls(adhocGroupby, {
        query_mode: { value: QueryMode.Aggregate },
      }),
      controlState,
    ),
  ).toBe(true);
  expect(
    vis(
      withControls(adhocGroupby, { query_mode: { value: QueryMode.Raw } }),
      controlState,
    ),
  ).toBe(false);
});
