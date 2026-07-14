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
  isCustomControlItem,
} from '@superset-ui/chart-controls';
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

test('time_grain_sqla visibility should be case-insensitive', () => {
  const vis = getVisibility(config, 'time_grain_sqla');
  const controlState = {} as ControlState;

  expect(vis(mkProps(['orderdate']), controlState)).toBe(true);
  expect(vis(mkProps(['ORDERDATE']), controlState)).toBe(true);
  expect(vis(mkProps(['some_other_col']), controlState)).toBe(false);
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
