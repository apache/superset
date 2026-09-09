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
  isCustomControlItem,
} from '@superset-ui/chart-controls';
import { ComparisonType, QueryMode } from '@superset-ui/core';
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

test('header_groups is always present without a visibility gate', () => {
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

  expect(item).toBeDefined();
  expect(item?.config.visibility).toBeUndefined();
  expect(item?.config.type).toBe('HeaderGroupsControl');
});

test('header_groups mapStateToProps builds time comparison groups', () => {
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

  const exploreState = {
    form_data: {
      metrics: ['revenue'],
      query_mode: QueryMode.Aggregate,
      comparison_type: ComparisonType.Values,
    },
    controls: { time_compare: { value: '1 year ago' } },
  } as unknown as ControlPanelState;

  expect(
    item?.config.shouldMapStateToProps?.(
      exploreState,
      exploreState,
      {} as ControlState,
    ),
  ).toBe(true);
  expect(
    item?.config.mapStateToProps?.(exploreState, {} as ControlState, {
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
  const timeCompare = { time_compare: { value: '1 year ago' } };

  expect(
    item?.config.mapStateToProps?.(
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
    item?.config.mapStateToProps?.(
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

test('show_totals renders in the customize tab atop visual formatting', () => {
  const visualFormatting = config.controlPanelSections.find(
    section => section?.label === 'Visual formatting',
  );
  expect(visualFormatting).toBeDefined();

  const [firstRow] = visualFormatting!.controlSetRows;
  const firstControl = firstRow[0] as CustomControlItem;
  expect(firstControl.name).toBe('show_totals');
  // renderTrigger keeps the whole section classified into the customize tab
  // and must not regress; without it the section moves to the data tab.
  expect(firstControl.config.renderTrigger).toBe(true);
  // No visibility gate: the summary checkbox must render in raw records
  // mode as well as aggregate mode.
  expect(firstControl.config.visibility).toBeUndefined();
});

test('every Visual formatting control is a renderTrigger', () => {
  // A non-renderTrigger control in this section would silently drag the
  // whole section's classification from the customize tab to the data tab.
  const visualFormatting = config.controlPanelSections.find(
    section => section?.label === 'Visual formatting',
  );
  expect(visualFormatting).toBeDefined();

  const controls = visualFormatting!.controlSetRows
    .flat()
    .filter(isCustomControlItem);
  expect(controls.length).toBeGreaterThan(0);

  controls.forEach(control => {
    expect(control.config.renderTrigger).toBe(true);
  });
});

function findControl(
  panel: ControlPanelConfig,
  controlName: string,
): CustomControlItem {
  const item = (panel.controlPanelSections || [])
    .flatMap(section => section?.controlSetRows || [])
    .flat()
    .find(c => isCustomControlItem(c) && c.name === controlName);

  if (!item || !isCustomControlItem(item)) {
    throw new Error(`Control "${controlName}" not found`);
  }
  return item;
}

test('allow_rearrange_columns defaults to false, matching v1, and hides while time_compare is set', () => {
  const control = findControl(config, 'allow_rearrange_columns');
  expect(control.config.type).toBe('CheckboxControl');
  expect(control.config.default).toBe(false);
  expect(control.config.renderTrigger).toBe(true);

  const vis = control.config.visibility as VisibilityFn;
  expect(
    vis({
      controls: { time_compare: { value: [] } },
    } as unknown as ControlPanelsContainerProps),
  ).toBe(true);
  expect(
    vis({
      controls: { time_compare: { value: ['1 year ago'] } },
    } as unknown as ControlPanelsContainerProps),
  ).toBe(false);
});

test('allow_render_html defaults to true, matching v1, and has no visibility gate', () => {
  const control = findControl(config, 'allow_render_html');
  expect(control.config.type).toBe('CheckboxControl');
  expect(control.config.default).toBe(true);
  expect(control.config.renderTrigger).toBe(true);
  expect(control.config.visibility).toBeUndefined();
});
