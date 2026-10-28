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

import { JsonObject, QueryFormData } from '@superset-ui/core';
import { Constants } from '@superset-ui/core/components';
import { render } from '@testing-library/react';
import {
  createTooltipContent,
  createHandlebarsTooltipData,
  CommonTooltipRows,
} from './tooltipUtils';
import { NULL_CATEGORY_KEY } from '../utils';

test('category row shows the null category as N/A, matching the legend', () => {
  const { container } = render(
    <>
      {CommonTooltipRows.category({ object: { cat_color: NULL_CATEGORY_KEY } })}
    </>,
  );

  expect(container.textContent).toContain(Constants.NULL_DISPLAY);
  expect(container.textContent).not.toContain(NULL_CATEGORY_KEY);
});

test('buildFieldBasedTooltipItems does not append configured metric when tooltip_contents already has string metric', () => {
  const formData = {
    datasource: '1__table',
    viz_type: 'deck_polygon',
    tooltip_contents: ['sum__value'],
    metric: 'sum__value',
  } as QueryFormData;

  const hoverData = {
    object: {
      sum__value: 10,
      metric: 10,
    },
  } as JsonObject;

  const content = createTooltipContent(formData, () => <div>default</div>);
  const { container } = render(content(hoverData));

  const metricRows =
    container.textContent?.match(/sum__value:\s*10/g)?.length || 0;

  expect(metricRows).toBe(1);
});

test('buildFieldBasedTooltipItems appends configured metric when tooltip_contents does not include it', () => {
  const formData = {
    datasource: '1__table',
    viz_type: 'deck_polygon',
    tooltip_contents: ['name'],
    metric: 'sum__value',
  } as QueryFormData;

  const hoverData = {
    object: {
      name: 'North',
      metric: 10,
    },
  } as JsonObject;

  const content = createTooltipContent(formData, () => <div>default</div>);
  const { container } = render(content(hoverData));

  expect(container.textContent).toContain('name: North');
  expect(container.textContent).toContain('sum__value: 10');
});

test('buildFieldBasedTooltipItems preserves zero configured metric fallback value', () => {
  const formData = {
    datasource: '1__table',
    viz_type: 'deck_polygon',
    tooltip_contents: ['name'],
    metric: 'sum__value',
  } as QueryFormData;

  const hoverData = {
    object: {
      name: 'North',
      metric: 0,
    },
  } as JsonObject;

  const content = createTooltipContent(formData, () => <div>default</div>);
  const { container } = render(content(hoverData));

  expect(container.textContent).toContain('name: North');
  expect(container.textContent).toContain('sum__value: 0');
});

test.each([[undefined], [['cat_color']]])(
  'handlebars data shows the null category as N/A (tooltip_contents=%j)',
  tooltipContents => {
    const formData = {
      datasource: '1__table',
      viz_type: 'deck_scatter',
      tooltip_contents: tooltipContents,
    } as QueryFormData;

    const data = createHandlebarsTooltipData(
      { object: { cat_color: NULL_CATEGORY_KEY } },
      formData,
    );

    expect(data.cat_color).toBe(Constants.NULL_DISPLAY);
  },
);

test('field-based tooltip shows the null category as N/A', () => {
  const formData = {
    datasource: '1__table',
    viz_type: 'deck_scatter',
    tooltip_contents: ['cat_color'],
  } as QueryFormData;

  const content = createTooltipContent(formData, () => <div>default</div>);
  const { container } = render(
    content({ object: { cat_color: NULL_CATEGORY_KEY } }),
  );

  expect(container.textContent).toContain(Constants.NULL_DISPLAY);
  expect(container.textContent).not.toContain(NULL_CATEGORY_KEY);
});

test('handlebars data leaves a non-sentinel cat_color value untouched', () => {
  const formData = {
    datasource: '1__table',
    viz_type: 'deck_scatter',
  } as QueryFormData;

  const data = createHandlebarsTooltipData(
    { object: { cat_color: ['A', 'B'] } },
    formData,
  );

  expect(data.cat_color).toEqual(['A', 'B']);
});
