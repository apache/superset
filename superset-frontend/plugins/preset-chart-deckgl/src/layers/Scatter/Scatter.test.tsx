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
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { getLayer } from './Scatter';

// maplibre-gl 6 is ESM-only, so jest can't resolve it; DeckGLContainer.tsx
// (pulled in via factory.tsx) calls setWorkerUrl() on it at import time.
jest.mock('maplibre-gl', () => ({ setWorkerUrl: jest.fn() }), {
  virtual: true,
});

test('default tooltip shows N/A, not <NULL>, for the null category sentinel', () => {
  const setTooltip = jest.fn();
  const layer = getLayer({
    formData: { slice_id: 1 },
    payload: { data: { features: [] } },
    setTooltip,
    setDataMask: () => {},
    onContextMenu: () => {},
    filterState: {},
    datasource: {},
    onSelect: () => {},
    emitCrossFilters: false,
  } as any);

  (layer.props as any).onHover({
    picked: true,
    x: 1,
    y: 2,
    object: { position: [1, 2], cat_color: '<NULL>' },
  });

  const { content } = setTooltip.mock.calls[0][0];
  render(content);
  expect(screen.getByText('N/A')).toBeInTheDocument();
  expect(screen.queryByText('<NULL>')).not.toBeInTheDocument();
});
