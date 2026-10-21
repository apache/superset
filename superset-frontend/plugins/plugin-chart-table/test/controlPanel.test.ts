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
  ControlPanelState,
  ControlPanelsContainerProps,
  ControlState,
  CustomControlItem,
  sharedControls,
} from '@superset-ui/chart-controls';
import { ComparisonType, QueryMode } from '@superset-ui/core';
import config from '../src/controlPanel';

test('Table temporal metadata distinguishes non-temporal from unknown columns', () => {
  const item = config.controlPanelSections
    .flatMap(section => section?.controlSetRows ?? [])
    .flat()
    .find(control =>
      typeof control === 'string'
        ? control === 'temporal_columns_lookup'
        : control &&
          'name' in control &&
          control.name === 'temporal_columns_lookup',
    );
  const control =
    typeof item === 'object' && item && 'config' in item
      ? item.config
      : sharedControls.temporal_columns_lookup;
  const { initialValue } = control;
  expect(typeof initialValue).toBe('function');
  if (typeof initialValue !== 'function') {
    throw new Error('Expected temporal lookup initializer');
  }
  const state = {
    datasource: {
      columns: [
        { column_name: 'metric_time', is_dttm: true },
        { column_name: 'country', is_dttm: false },
        { column_name: 'unknown' },
      ],
    },
  } as unknown as Parameters<typeof initialValue>[1];
  expect(initialValue({} as ControlState, state)).toEqual({
    metric_time: true,
    country: false,
  });
});

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

function getHeaderGroupsControl() {
  const item = (config.controlPanelSections || [])
    .flatMap(section => section?.controlSetRows || [])
    .flat()
    .find(
      control =>
        typeof control === 'object' &&
        control !== null &&
        'name' in control &&
        control.name === 'header_groups',
    ) as CustomControlItem | undefined;
  if (!item) {
    throw new Error('header_groups control not found');
  }
  return item;
}

test('time comparison section is visible only in aggregate mode', () => {
  const section = (config.controlPanelSections || []).find(
    item => item && 'visibility' in item && item.label === 'Time Comparison',
  );
  expect(section?.visibility).toBeDefined();
  expect(
    section?.visibility?.(
      {
        controls: { query_mode: { value: QueryMode.Aggregate } },
      } as unknown as ControlPanelsContainerProps,
      {},
    ),
  ).toBe(true);
  expect(
    section?.visibility?.(
      {
        controls: { query_mode: { value: QueryMode.Raw } },
      } as unknown as ControlPanelsContainerProps,
      {},
    ),
  ).toBe(false);
});

test('header_groups is always present without a visibility gate', () => {
  const item = getHeaderGroupsControl();

  expect(item).toBeDefined();
  expect(item.config.visibility).toBeUndefined();
});

test('header_groups mapStateToProps builds time comparison groups', () => {
  const item = getHeaderGroupsControl();

  const exploreState = {
    form_data: {
      metrics: ['revenue'],
      query_mode: QueryMode.Aggregate,
      comparison_type: ComparisonType.Values,
    },
    controls: { time_compare: { value: '1 year ago' } },
  } as unknown as ControlPanelState;

  expect(
    item.config.shouldMapStateToProps?.(
      exploreState,
      exploreState,
      {} as ControlState,
    ),
  ).toBe(true);
  expect(
    item.config.mapStateToProps?.(exploreState, {} as ControlState, {
      queriesResponse: null,
    }),
  ).toEqual(
    expect.objectContaining({
      timeComparisonGroups: [
        expect.objectContaining({
          id: 'time-compare-revenue',
          source: 'time_compare',
        }),
      ],
    }),
  );
});

test('header_groups mapStateToProps skips auto groups outside aggregate values comparison', () => {
  const item = getHeaderGroupsControl();
  const timeCompare = { time_compare: { value: '1 year ago' } };

  expect(
    item.config.mapStateToProps?.(
      {
        form_data: {
          metrics: ['revenue'],
          query_mode: QueryMode.Raw,
          comparison_type: ComparisonType.Values,
        },
        controls: timeCompare,
      } as unknown as ControlPanelState,
      {} as ControlState,
      { queriesResponse: null },
    )?.timeComparisonGroups,
  ).toEqual([]);
  expect(
    item.config.mapStateToProps?.(
      {
        form_data: {
          metrics: ['revenue'],
          query_mode: QueryMode.Aggregate,
          comparison_type: ComparisonType.Difference,
        },
        controls: timeCompare,
      } as unknown as ControlPanelState,
      {} as ControlState,
      { queriesResponse: null },
    )?.timeComparisonGroups,
  ).toEqual([]);
});

test('allow_rearrange_columns is hidden when time comparison or header groups are set', () => {
  const vis = getVisibility(config, 'allow_rearrange_columns');
  expect(
    vis({
      controls: { time_compare: { value: [] }, header_groups: { value: [] } },
    } as unknown as ControlPanelsContainerProps),
  ).toBe(true);
  expect(
    vis({
      controls: {
        time_compare: { value: '1 year ago' },
        header_groups: { value: [] },
      },
    } as unknown as ControlPanelsContainerProps),
  ).toBe(false);
  expect(
    vis({
      controls: {
        time_compare: { value: [] },
        header_groups: { value: [{ id: 'g1' }] },
      },
    } as unknown as ControlPanelsContainerProps),
  ).toBe(false);
});

test('time_grain_sqla visibility should be case-insensitive', () => {
  const vis = getVisibility(config, 'time_grain_sqla');
  const controlState = {} as ControlState;

  expect(vis(mkProps(['orderdate']), controlState)).toBe(true);
  expect(vis(mkProps(['ORDERDATE']), controlState)).toBe(true);
  expect(vis(mkProps(['some_other_col']), controlState)).toBe(false);
});

test('time grain visibility follows axis removal and re-addition', () => {
  const visible = getVisibility(config, 'time_grain_sqla');
  expect(visible(mkProps(['ORDERDATE']))).toBe(true);
  expect(visible(mkProps([]))).toBe(false);
  expect(visible(mkProps(['some_other_col']))).toBe(false);
  expect(visible(mkProps(['ORDERDATE']))).toBe(true);
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

/**
 * Finds the visibility function of a control whether it is declared through a
 * full `config` (e.g. `all_columns`) or through an `override` of a shared
 * control (e.g. `groupby`, `metrics`).
 */
function getModeVisibility(controlName: string): VisibilityFn {
  const item = (config.controlPanelSections || [])
    .flatMap(section => section?.controlSetRows || [])
    .flat()
    .find(
      c =>
        typeof c === 'object' &&
        c !== null &&
        'name' in c &&
        (c as { name: string }).name === controlName,
    ) as
    | {
        config?: { visibility?: VisibilityFn };
        override?: { visibility?: VisibilityFn };
      }
    | undefined;
  const visibility = item?.config?.visibility ?? item?.override?.visibility;
  if (typeof visibility !== 'function') {
    throw new Error(`Control "${controlName}" with visibility not found`);
  }
  return visibility;
}

const modeProps = (mode: QueryMode): ControlPanelsContainerProps =>
  ({
    controls: { query_mode: { value: mode } },
  }) as unknown as ControlPanelsContainerProps;

test('raw mode shows the raw-only controls and hides the aggregate-only controls', () => {
  const props = modeProps(QueryMode.Raw);

  expect(getModeVisibility('all_columns')(props)).toBe(true);
  expect(getModeVisibility('order_by_cols')(props)).toBe(true);
  expect(getModeVisibility('groupby')(props)).toBe(false);
  expect(getModeVisibility('metrics')(props)).toBe(false);
  expect(getModeVisibility('percent_metrics')(props)).toBe(false);
  expect(getModeVisibility('timeseries_limit_metric')(props)).toBe(false);
});

test('aggregate mode shows the aggregate-only controls and hides the raw-only controls', () => {
  const props = modeProps(QueryMode.Aggregate);

  expect(getModeVisibility('groupby')(props)).toBe(true);
  expect(getModeVisibility('metrics')(props)).toBe(true);
  expect(getModeVisibility('percent_metrics')(props)).toBe(true);
  expect(getModeVisibility('timeseries_limit_metric')(props)).toBe(true);
  expect(getModeVisibility('all_columns')(props)).toBe(false);
  expect(getModeVisibility('order_by_cols')(props)).toBe(false);
});
