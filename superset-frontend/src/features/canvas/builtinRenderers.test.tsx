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
import { render, screen } from 'spec/helpers/testing-library';
import CanvasGrid, { emptyScopeValues } from './CanvasGrid';
import { registerBuiltinRenderers } from './builtinRenderers';
import { CanvasDefinitionResult } from './types';

const inline = (
  widgetType: string,
  props: Record<string, unknown> = {},
  children?: string[],
) => ({ widgetType, schemaVersion: 1, props, layout: {}, children });

const result: CanvasDefinitionResult = {
  version: 1,
  revision: 1,
  definition: {
    version: 1,
    root: {
      layout: { columns: 24, gap: 16, rowUnit: 40 },
      children: ['overview', 'kpis'],
    },
    nodes: {
      overview: inline('tabs', {}, ['emea', 'apac']),
      emea: inline('tab', { title: 'EMEA' }, ['notes']),
      apac: inline('tab', {}, []),
      notes: inline('markdown', { content: '**Quarterly** notes' }),
      kpis: inline('group', { title: 'Key numbers' }, []),
    },
    interactions: { filters: {}, crossFilters: {}, customizations: {} },
    settings: {
      refresh: { interval: 0, stagger: 0, exempt: [] },
      colors: { labelColors: {} },
      display: { showTimestamps: false },
      crossFilters: { enabled: true },
    },
  },
  filterScopes: {},
  crossFilterScopes: {},
  customizationScopes: {},
  placements: {},
  widgetTypes: {
    overview: 'tabs',
    emea: 'tab',
    apac: 'tab',
    notes: 'markdown',
    kpis: 'group',
  },
  gridColumns: { emea: 24, apac: 24, kpis: 12 },
};

test('renders core containers and markdown without extensions', () => {
  registerBuiltinRenderers();
  render(
    <CanvasGrid
      canvasId={1}
      result={result}
      values={emptyScopeValues()}
      onValueChange={jest.fn()}
    />,
  );

  expect(screen.getByRole('tab', { name: 'EMEA' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Untitled tab' })).toBeInTheDocument();
  expect(screen.getByText('Quarterly')).toBeInTheDocument();
  expect(screen.getByText('Key numbers')).toBeInTheDocument();
});
