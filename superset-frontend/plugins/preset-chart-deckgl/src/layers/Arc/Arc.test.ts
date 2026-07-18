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
import { COLOR_SCHEME_TYPES } from '../../utilities/utils';
import { getLayer } from './Arc';

const baseArgs = {
  payload: { data: { features: [] } },
  setTooltip: () => {},
  setDataMask: () => {},
  onContextMenu: () => {},
  filterState: {},
  datasource: {},
  onSelect: () => {},
  emitCrossFilters: false,
} as any;

const sampleDatum = {} as any;

test('falls back to the default color when target_color_picker is missing', () => {
  // Sub-slices in deck.gl Multiple Layers arrive without control-default
  // hydration, and the Arc example never saved target_color_picker; the color
  // accessors must not crash on the missing color.
  const formData = {
    color_scheme_type: COLOR_SCHEME_TYPES.fixed_color,
    color_picker: { r: 10, g: 20, b: 30, a: 1 },
    // target_color_picker intentionally omitted
  } as any;

  const layer = getLayer({ ...baseArgs, formData });

  expect(layer.props.getSourceColor(sampleDatum)).toEqual([10, 20, 30, 255]);
  // Missing target color resolves to PRIMARY_COLOR { r:0, g:122, b:135, a:1 }
  expect(layer.props.getTargetColor(sampleDatum)).toEqual([0, 122, 135, 255]);
});

test('uses the configured source and target colors when both are present', () => {
  const formData = {
    color_scheme_type: COLOR_SCHEME_TYPES.fixed_color,
    color_picker: { r: 10, g: 20, b: 30, a: 1 },
    target_color_picker: { r: 40, g: 50, b: 60, a: 1 },
  } as any;

  const layer = getLayer({ ...baseArgs, formData });

  expect(layer.props.getSourceColor(sampleDatum)).toEqual([10, 20, 30, 255]);
  expect(layer.props.getTargetColor(sampleDatum)).toEqual([40, 50, 60, 255]);
});
