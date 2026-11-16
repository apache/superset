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
import { ReactNode, ReactElement } from 'react';
import '@testing-library/jest-dom';
import { ThemeProvider, supersetTheme } from '@apache-superset/core/theme';
import type { canvas as canvasApi } from '@apache-superset/core';
import { SupersetClient } from '@superset-ui/core';
import {
  act,
  fireEvent,
  render as renderComponent,
  screen,
  waitFor,
} from '@testing-library/react';
import FilterSelectRenderer from './FilterSelectRenderer';
import { CanvasDraftContext } from './useWidgetRows';

jest.mock('@superset-ui/core/components', () => ({
  Typography: {
    Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  },
  Select: ({
    options,
    value,
    onChange,
  }: {
    options: { value: string; label: string }[];
    value: string[];
    onChange: (value: string[]) => void;
  }) => (
    <>
      <select
        aria-label="values"
        multiple
        value={value}
        onChange={event =>
          onChange(
            Array.from(event.target.selectedOptions, option => option.value),
          )
        }
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <output data-test="selection">{JSON.stringify(value)}</output>
    </>
  ),
}));

const render = (
  element: ReactElement,
  options?: { wrapper: (props: { children: ReactNode }) => ReactElement },
) =>
  renderComponent(element, {
    wrapper: ({ children }) => (
      <ThemeProvider theme={supersetTheme}>
        {options?.wrapper ? (
          <options.wrapper>{children}</options.wrapper>
        ) : (
          children
        )}
      </ThemeProvider>
    ),
  });

const widget: canvasApi.CanvasWidgetProps = {
  canvasId: 1,
  nodeId: 'filter',
  widgetType: 'filter.select',
  props: { datasetId: 13, column: 'region' },
  filters: [],
  crossFilters: [],
  customizations: [],
  setFilterValue: jest.fn(),
  setCrossFilter: jest.fn(),
  crossFiltersEnabled: false,
  setCustomizationValue: jest.fn(),
  events: [],
  publish: jest.fn(),
  colors: { labelColors: {} },
  showTimestamp: false,
  refreshKey: 0,
  childNodes: [],
  renderGrid: () => null,
};

function deferredResult() {
  let resolve!: (response: { json: { result: string[] } }) => void;
  const promise = new Promise<{ json: { result: string[] } }>(yes => {
    resolve = yes;
  });
  return { promise, resolve };
}
const response = (result: string[]) =>
  ({ json: { result } }) as Awaited<ReturnType<typeof SupersetClient.get>>;
beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.restoreAllMocks());

test.each([
  ['dataset', { datasetId: 14, column: 'region' }],
  ['column', { datasetId: 13, column: 'country' }],
])(
  'clears old options and applies the new default when the %s changes',
  async (_name, source) => {
    const next = deferredResult();
    jest
      .spyOn(SupersetClient, 'get')
      .mockResolvedValueOnce(response(['north', 'south']))
      .mockReturnValue(next.promise as ReturnType<typeof SupersetClient.get>);
    const initial = {
      ...widget,
      props: { ...widget.props, defaultSelection: ['north'] },
    };
    const { rerender } = render(<FilterSelectRenderer {...initial} />);
    await screen.findByRole('option', { name: 'north' });
    expect(widget.setFilterValue).toHaveBeenCalledWith({
      datasetId: 13,
      column: 'region',
      values: ['north'],
    });
    jest.mocked(widget.setFilterValue).mockClear();
    rerender(
      <FilterSelectRenderer
        {...initial}
        props={{ ...source, defaultSelection: ['west'] }}
      />,
    );
    expect(
      screen.queryByRole('option', { name: 'north' }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('selection')).toHaveTextContent('["west"]');
    expect(widget.setFilterValue).toHaveBeenCalledTimes(1);
    expect(widget.setFilterValue).toHaveBeenCalledWith({
      ...source,
      values: ['west'],
    });
    await act(async () => next.resolve({ json: { result: ['west'] } }));
    expect(screen.getByRole('option', { name: 'west' })).toBeInTheDocument();
    expect(screen.getByTestId('selection')).toHaveTextContent('["west"]');
  },
);

test('preserves selection on prop edits and applies defaults on a new source', () => {
  const initial = {
    ...widget,
    props: {
      ...widget.props,
      options: ['north', 'west'],
      defaultSelection: ['north'],
    },
  };
  const { rerender } = render(<FilterSelectRenderer {...initial} />);
  fireEvent.change(screen.getByRole('listbox'), { target: { value: 'west' } });
  expect(screen.getByTestId('selection')).toHaveTextContent('["west"]');
  rerender(
    <FilterSelectRenderer
      {...initial}
      props={{ ...initial.props, defaultSelection: ['other'] }}
    />,
  );
  expect(screen.getByTestId('selection')).toHaveTextContent('["west"]');
  rerender(
    <FilterSelectRenderer
      {...initial}
      props={{ ...initial.props, datasetId: 14, defaultSelection: ['other'] }}
    />,
  );
  expect(screen.getByTestId('selection')).toHaveTextContent('["other"]');
  expect(widget.setFilterValue).toHaveBeenLastCalledWith({
    datasetId: 14,
    column: 'region',
    values: ['other'],
  });
});

test('ignores late option results from the previous source', async () => {
  const old = deferredResult();
  jest
    .spyOn(SupersetClient, 'get')
    .mockReturnValueOnce(old.promise as ReturnType<typeof SupersetClient.get>)
    .mockResolvedValueOnce(response(['current']));
  const { rerender } = render(<FilterSelectRenderer {...widget} />);
  rerender(
    <FilterSelectRenderer
      {...widget}
      props={{ datasetId: 14, column: 'region' }}
    />,
  );
  await screen.findByRole('option', { name: 'current' });
  await act(async () => old.resolve({ json: { result: ['previous'] } }));
  expect(
    screen.queryByRole('option', { name: 'previous' }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'current' })).toBeInTheDocument();
});

test('clears fetched values when switching between static and fetched options', async () => {
  jest
    .spyOn(SupersetClient, 'get')
    .mockResolvedValueOnce(response(['old fetched']))
    .mockReturnValue(new Promise(() => {}));
  const { rerender } = render(<FilterSelectRenderer {...widget} />);
  await screen.findByRole('option', { name: 'old fetched' });
  rerender(
    <FilterSelectRenderer
      {...widget}
      props={{ ...widget.props, options: ['static'] }}
    />,
  );
  expect(screen.getByRole('option', { name: 'static' })).toBeInTheDocument();
  rerender(<FilterSelectRenderer {...widget} />);
  expect(screen.queryAllByRole('option')).toHaveLength(0);
});

test('keeps selection when entering and leaving a draft with an unchanged binding', async () => {
  const get = jest
    .spyOn(SupersetClient, 'get')
    .mockResolvedValue(response(['old', 'chosen']));
  let token: string | undefined;
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <CanvasDraftContext.Provider value={token}>
      {children}
    </CanvasDraftContext.Provider>
  );
  const initial = {
    ...widget,
    props: { ...widget.props, defaultSelection: ['old'] },
  };
  const { rerender } = render(<FilterSelectRenderer {...initial} />, {
    wrapper: Wrapper,
  });
  await screen.findByRole('option', { name: 'chosen' });
  fireEvent.change(screen.getByRole('listbox'), {
    target: { value: 'chosen' },
  });
  jest.mocked(widget.setFilterValue).mockClear();
  token = 'draft-token';
  rerender(<FilterSelectRenderer {...initial} />);
  await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  expect(screen.getByTestId('selection')).toHaveTextContent('["chosen"]');
  token = undefined;
  rerender(<FilterSelectRenderer {...initial} />);
  await waitFor(() => expect(get).toHaveBeenCalledTimes(3));
  expect(screen.getByTestId('selection')).toHaveTextContent('["chosen"]');
  expect(widget.setFilterValue).not.toHaveBeenCalled();
});

test('retains options during refresh and clears them after denial', async () => {
  let reject!: (reason: unknown) => void;
  const pending = new Promise((resolve, fail) => {
    reject = fail;
  });
  jest
    .spyOn(SupersetClient, 'get')
    .mockResolvedValueOnce(response(['restricted']))
    .mockReturnValueOnce(pending as ReturnType<typeof SupersetClient.get>);
  const { rerender } = render(<FilterSelectRenderer {...widget} />);
  await screen.findByRole('option', { name: 'restricted' });
  rerender(<FilterSelectRenderer {...widget} refreshKey={1} />);
  expect(
    screen.getByRole('option', { name: 'restricted' }),
  ).toBeInTheDocument();
  await act(async () => reject(new Error('source denied')));
  expect(screen.queryAllByRole('option')).toHaveLength(0);
});

test('replaces options only when a refresh succeeds', async () => {
  const pending = deferredResult();
  jest
    .spyOn(SupersetClient, 'get')
    .mockResolvedValueOnce(response(['old']))
    .mockReturnValueOnce(
      pending.promise as ReturnType<typeof SupersetClient.get>,
    );
  const { rerender } = render(<FilterSelectRenderer {...widget} />);
  await screen.findByRole('option', { name: 'old' });
  rerender(<FilterSelectRenderer {...widget} refreshKey={1} />);
  expect(screen.getByRole('option', { name: 'old' })).toBeInTheDocument();
  await act(async () => pending.resolve({ json: { result: ['new'] } }));
  expect(screen.queryByRole('option', { name: 'old' })).not.toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'new' })).toBeInTheDocument();
});
