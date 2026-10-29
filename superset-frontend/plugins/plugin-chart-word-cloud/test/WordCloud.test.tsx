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
import WordCloud from '../src/chart/WordCloud';
import type { PlainObject, Word } from '../src/chart/WordCloud';

// Shared state for the d3-cloud mock; `mock` prefix allows use inside
// the hoisted jest.mock factory
const mockCloudState = {
  sizes: [] as Array<[number, number]>,
  // When true, the first layout run returns an incomplete word set,
  // forcing the component to retry at a larger scale factor
  dropFirstLayout: false,
};

jest.mock('d3-cloud', () =>
  jest.fn(() => {
    const config: {
      size?: [number, number];
      words?: Word[];
      text?: (d: PlainObject) => string;
      end?: (words: Word[]) => void;
    } = {};
    const layout = {
      size(s: [number, number]) {
        config.size = s;
        return layout;
      },
      words(w: Word[]) {
        config.words = w;
        return layout;
      },
      padding() {
        return layout;
      },
      rotate() {
        return layout;
      },
      text(fn: (d: PlainObject) => string) {
        config.text = fn;
        return layout;
      },
      font() {
        return layout;
      },
      fontWeight() {
        return layout;
      },
      fontSize() {
        return layout;
      },
      on(_event: string, cb: (words: Word[]) => void) {
        config.end = cb;
        return layout;
      },
      start() {
        mockCloudState.sizes.push(config.size ?? [0, 0]);
        const out = (config.words ?? []).map((w, i) => ({
          ...w,
          text: config.text?.(w as PlainObject) ?? '',
          size: 20,
          x: i * 10,
          y: i * 10,
          rotate: 0,
          font: 'Arial',
          weight: 'bold',
        }));
        const isFirstRun = mockCloudState.sizes.length === 1;
        config.end?.(
          mockCloudState.dropFirstLayout && isFirstRun ? out.slice(0, 1) : out,
        );
        return layout;
      },
    };
    return layout;
  }),
);

beforeEach(() => {
  mockCloudState.sizes = [];
  mockCloudState.dropFirstLayout = false;
});

const defaultProps = {
  data: [{ text: 'alpha' }, { text: 'beta' }, { text: 'gamma' }],
  encoding: { text: { field: 'text' } },
  width: 200,
  height: 100,
  sliceId: 1,
  colorScheme: 'supersetColors',
};

test('renders a text element for each word', () => {
  render(<WordCloud {...defaultProps} />);

  expect(screen.getByText('alpha')).toBeInTheDocument();
  expect(screen.getByText('beta')).toBeInTheDocument();
  expect(screen.getByText('gamma')).toBeInTheDocument();
});

test('uses a 1x viewBox when the first layout fits all top words', () => {
  const { container } = render(<WordCloud {...defaultProps} />);

  expect(mockCloudState.sizes).toEqual([[200, 100]]);
  expect(container.querySelector('svg')).toHaveAttribute(
    'viewBox',
    '-100 -50 200 100',
  );
});

test('retries at a larger scale factor and matches the viewBox to it', () => {
  mockCloudState.dropFirstLayout = true;

  const { container } = render(<WordCloud {...defaultProps} />);

  // First run at 1x drops words, so the layout escalates to 1.5x
  expect(mockCloudState.sizes).toEqual([
    [200, 100],
    [300, 150],
  ]);
  expect(container.querySelector('svg')).toHaveAttribute(
    'viewBox',
    '-150 -75 300 150',
  );
});

test('recomputes the layout when data changes', () => {
  const { rerender } = render(<WordCloud {...defaultProps} />);
  expect(mockCloudState.sizes).toHaveLength(1);

  rerender(<WordCloud {...defaultProps} data={[{ text: 'delta' }]} />);

  expect(mockCloudState.sizes).toHaveLength(2);
  expect(screen.getByText('delta')).toBeInTheDocument();
  expect(screen.queryByText('alpha')).not.toBeInTheDocument();
});

test('does not recompute the layout for an unchanged rerender', () => {
  const { rerender } = render(<WordCloud {...defaultProps} />);
  expect(mockCloudState.sizes).toHaveLength(1);

  rerender(<WordCloud {...defaultProps} />);

  expect(mockCloudState.sizes).toHaveLength(1);
});
