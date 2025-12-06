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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { SupersetClient } from '@superset-ui/core';
import DeckglLayerVisibilityCustomizationPlugin from './DeckglLayerVisibilityCustomizationPlugin';
import { PluginDeckglLayerVisibilityProps } from './types';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  SupersetClient: {
    get: jest.fn(),
  },
}));

const mockSupersetClientGet = SupersetClient.get as jest.Mock;

const defaultProps: PluginDeckglLayerVisibilityProps = {
  formData: {
    viz_type: 'deckgl_layer_visibility',
    defaultToAllLayersVisible: true,
    datasource: '1__table',
  },
  height: 400,
  width: 600,
  filterState: {},
  setDataMask: jest.fn(),
};

const mockCharts = {
  chart1: {
    form_data: {
      viz_type: 'deck_multi',
      deck_slices: [1, 2, 3],
    },
  },
  chart2: {
    form_data: {
      viz_type: 'deck_multi',
      deck_slices: [4, 5],
    },
  },
  chart3: {
    form_data: {
      viz_type: 'line',
    },
  },
};

const mockApiResponse = {
  json: {
    result: [
      { id: 1, slice_name: 'Scatter Layer', viz_type: 'deck_scatter' },
      { id: 2, slice_name: 'Arc Layer', viz_type: 'deck_arc' },
      { id: 3, slice_name: 'Path Layer', viz_type: 'deck_path' },
      { id: 4, slice_name: 'Hex Layer', viz_type: 'deck_hex' },
      { id: 5, slice_name: 'Grid Layer', viz_type: 'deck_grid' },
    ],
  },
};

test('displays loading state initially', () => {
  mockSupersetClientGet.mockImplementation(() => new Promise(() => {}));

  render(<DeckglLayerVisibilityCustomizationPlugin {...defaultProps} />, {
    useRedux: true,
    initialState: {
      sliceEntities: { slices: mockCharts },
    },
  });

  expect(screen.getByText('Loading deck.gl layers...')).toBeInTheDocument();
});

test('displays message when no deck.gl multi layer charts are found', async () => {
  mockSupersetClientGet.mockResolvedValue({ json: { result: [] } });

  render(<DeckglLayerVisibilityCustomizationPlugin {...defaultProps} />, {
    useRedux: true,
    initialState: {
      sliceEntities: {
        slices: {
          chart1: {
            form_data: {
              viz_type: 'line',
            },
          },
        },
      },
    },
  });

  await waitFor(() => {
    expect(
      screen.getByText(
        'No deck.gl multi layer charts found in this dashboard.',
      ),
    ).toBeInTheDocument();
  });
});

test('renders layer selection control with layers from API', async () => {
  mockSupersetClientGet.mockResolvedValue(mockApiResponse);

  render(<DeckglLayerVisibilityCustomizationPlugin {...defaultProps} />, {
    useRedux: true,
    initialState: {
      sliceEntities: { slices: mockCharts },
    },
  });

  await waitFor(() => {
    expect(screen.getByText('Exclude layers (deck.gl)')).toBeInTheDocument();
  });

  expect(screen.getByRole('combobox')).toBeInTheDocument();
});

test('collects unique layer IDs from multiple deck_multi charts', async () => {
  mockSupersetClientGet.mockResolvedValue(mockApiResponse);

  render(<DeckglLayerVisibilityCustomizationPlugin {...defaultProps} />, {
    useRedux: true,
    initialState: {
      sliceEntities: { slices: mockCharts },
    },
  });

  await waitFor(() => {
    expect(mockSupersetClientGet).toHaveBeenCalled();
  });

  const callArgs = mockSupersetClientGet.mock.calls[0][0];
  expect(callArgs.endpoint).toContain('/api/v1/chart/?q=');
});

test('handles layer selection and calls setDataMask', async () => {
  mockSupersetClientGet.mockResolvedValue(mockApiResponse);
  const setDataMaskMock = jest.fn();

  render(
    <DeckglLayerVisibilityCustomizationPlugin
      {...defaultProps}
      setDataMask={setDataMaskMock}
    />,
    {
      useRedux: true,
      initialState: {
        sliceEntities: { slices: mockCharts },
      },
    },
  );

  await waitFor(() => {
    expect(screen.getByText('Exclude layers (deck.gl)')).toBeInTheDocument();
  });

  const select = screen.getByRole('combobox');
  await userEvent.click(select);

  await waitFor(() => {
    expect(
      screen.getByText('Scatter Layer (deck_scatter)'),
    ).toBeInTheDocument();
  });

  await userEvent.click(screen.getByText('Scatter Layer (deck_scatter)'));

  await waitFor(() => {
    expect(setDataMaskMock).toHaveBeenCalledWith({
      filterState: {
        value: [1],
      },
      extraFormData: {
        visible_deckgl_layers: [2, 3, 4, 5],
      },
    });
  });
});

test('initializes with filterState value when provided', async () => {
  mockSupersetClientGet.mockResolvedValue(mockApiResponse);

  render(
    <DeckglLayerVisibilityCustomizationPlugin
      {...defaultProps}
      filterState={{ value: [1, 2] }}
    />,
    {
      useRedux: true,
      initialState: {
        sliceEntities: { slices: mockCharts },
      },
    },
  );

  await waitFor(() => {
    expect(screen.getByText('Exclude layers (deck.gl)')).toBeInTheDocument();
  });

  const select = screen.getByRole('combobox');
  await userEvent.click(select);

  await waitFor(() => {
    const selectedItems = screen.getAllByRole('option', { selected: true });
    expect(selectedItems).toHaveLength(2);
  });
});

test('initializes all layers visible when defaultToAllLayersVisible is true and no prior state', async () => {
  mockSupersetClientGet.mockResolvedValue(mockApiResponse);
  const setDataMaskMock = jest.fn();

  render(
    <DeckglLayerVisibilityCustomizationPlugin
      {...defaultProps}
      formData={{
        viz_type: 'deckgl_layer_visibility',
        defaultToAllLayersVisible: true,
        datasource: '1__table',
      }}
      setDataMask={setDataMaskMock}
    />,
    {
      useRedux: true,
      initialState: {
        sliceEntities: { slices: mockCharts },
      },
    },
  );

  await waitFor(() => {
    expect(setDataMaskMock).toHaveBeenCalledWith({
      filterState: {
        value: [],
      },
      extraFormData: {
        visible_deckgl_layers: [1, 2, 3, 4, 5],
      },
    });
  });
});

test('does not auto-initialize when defaultToAllLayersVisible is false', async () => {
  mockSupersetClientGet.mockResolvedValue(mockApiResponse);
  const setDataMaskMock = jest.fn();

  render(
    <DeckglLayerVisibilityCustomizationPlugin
      {...defaultProps}
      formData={{
        viz_type: 'deckgl_layer_visibility',
        defaultToAllLayersVisible: false,
        datasource: '1__table',
      }}
      setDataMask={setDataMaskMock}
    />,
    {
      useRedux: true,
      initialState: {
        sliceEntities: { slices: mockCharts },
      },
    },
  );

  await waitFor(() => {
    expect(screen.getByText('Exclude layers (deck.gl)')).toBeInTheDocument();
  });

  expect(setDataMaskMock).not.toHaveBeenCalled();
});

test('handles multiple layer selection', async () => {
  mockSupersetClientGet.mockResolvedValue(mockApiResponse);
  const setDataMaskMock = jest.fn();

  render(
    <DeckglLayerVisibilityCustomizationPlugin
      {...defaultProps}
      setDataMask={setDataMaskMock}
    />,
    {
      useRedux: true,
      initialState: {
        sliceEntities: { slices: mockCharts },
      },
    },
  );

  await waitFor(() => {
    expect(screen.getByText('Exclude layers (deck.gl)')).toBeInTheDocument();
  });

  const select = screen.getByRole('combobox');
  await userEvent.click(select);

  await waitFor(() => {
    expect(
      screen.getByText('Scatter Layer (deck_scatter)'),
    ).toBeInTheDocument();
  });

  await userEvent.click(screen.getByText('Scatter Layer (deck_scatter)'));
  await userEvent.click(screen.getByText('Arc Layer (deck_arc)'));

  await waitFor(() => {
    expect(setDataMaskMock).toHaveBeenLastCalledWith({
      filterState: {
        value: expect.arrayContaining([1, 2]),
      },
      extraFormData: {
        visible_deckgl_layers: expect.arrayContaining([3, 4, 5]),
      },
    });
  });
});

test('displays tooltip info icon', async () => {
  mockSupersetClientGet.mockResolvedValue(mockApiResponse);

  render(<DeckglLayerVisibilityCustomizationPlugin {...defaultProps} />, {
    useRedux: true,
    initialState: {
      sliceEntities: { slices: mockCharts },
    },
  });

  await waitFor(() => {
    expect(screen.getByText('Exclude layers (deck.gl)')).toBeInTheDocument();
  });

  const tooltipIcon = screen.getByRole('img', { name: /info-circle/i });
  expect(tooltipIcon).toBeInTheDocument();

  await userEvent.hover(tooltipIcon);

  await waitFor(() => {
    expect(
      screen.getByText(
        'Choose layers to hide from all deck.gl Multiple Layer charts in this dashboard.',
      ),
    ).toBeInTheDocument();
  });
});

test('handles charts with undefined deck_slices', async () => {
  mockSupersetClientGet.mockResolvedValue({ json: { result: [] } });

  const chartsWithUndefined = {
    chart1: {
      form_data: {
        viz_type: 'deck_multi',
      },
    },
  };

  render(<DeckglLayerVisibilityCustomizationPlugin {...defaultProps} />, {
    useRedux: true,
    initialState: {
      sliceEntities: { slices: chartsWithUndefined },
    },
  });

  await waitFor(() => {
    expect(
      screen.getByText(
        'No deck.gl multi layer charts found in this dashboard.',
      ),
    ).toBeInTheDocument();
  });
});

test('handles charts with non-array deck_slices', async () => {
  mockSupersetClientGet.mockResolvedValue({ json: { result: [] } });

  const chartsWithInvalidSlices = {
    chart1: {
      form_data: {
        viz_type: 'deck_multi',
        deck_slices: 'invalid',
      },
    },
  };

  render(<DeckglLayerVisibilityCustomizationPlugin {...defaultProps} />, {
    useRedux: true,
    initialState: {
      sliceEntities: { slices: chartsWithInvalidSlices },
    },
  });

  await waitFor(() => {
    expect(
      screen.getByText(
        'No deck.gl multi layer charts found in this dashboard.',
      ),
    ).toBeInTheDocument();
  });
});

test('deduplicates layer IDs from multiple charts', async () => {
  mockSupersetClientGet.mockResolvedValue(mockApiResponse);

  const chartsWithDuplicates = {
    chart1: {
      form_data: {
        viz_type: 'deck_multi',
        deck_slices: [1, 2, 3],
      },
    },
    chart2: {
      form_data: {
        viz_type: 'deck_multi',
        deck_slices: [2, 3, 4],
      },
    },
  };

  render(<DeckglLayerVisibilityCustomizationPlugin {...defaultProps} />, {
    useRedux: true,
    initialState: {
      sliceEntities: { slices: chartsWithDuplicates },
    },
  });

  await waitFor(() => {
    expect(mockSupersetClientGet).toHaveBeenCalled();
  });

  const callArgs = mockSupersetClientGet.mock.calls[0][0];
  expect(callArgs.endpoint).toContain('/api/v1/chart/?q=');
});

test('respects existing visible_deckgl_layers from Redux state', async () => {
  mockSupersetClientGet.mockResolvedValue(mockApiResponse);
  const setDataMaskMock = jest.fn();

  render(
    <DeckglLayerVisibilityCustomizationPlugin
      {...defaultProps}
      formData={{
        viz_type: 'deckgl_layer_visibility',
        defaultToAllLayersVisible: true,
        datasource: '1__table',
      }}
      setDataMask={setDataMaskMock}
    />,
    {
      useRedux: true,
      initialState: {
        sliceEntities: { slices: mockCharts },
        dataMask: {
          filter1: {
            extraFormData: {
              visible_deckgl_layers: [1, 2],
            },
          },
        },
      },
    },
  );

  await waitFor(() => {
    expect(screen.getByText('Exclude layers (deck.gl)')).toBeInTheDocument();
  });

  expect(setDataMaskMock).not.toHaveBeenCalled();
});
