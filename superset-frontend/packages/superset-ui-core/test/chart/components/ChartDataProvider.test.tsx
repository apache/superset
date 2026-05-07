/*
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
import '@testing-library/jest-dom';
import { render, screen, act } from '@testing-library/react';
import ChartClient from '../../../src/chart/clients/ChartClient';
import ChartDataProvider, {
  ChartDataProviderProps,
} from '../../../src/chart/components/ChartDataProvider';
import { bigNumberFormData } from '../fixtures/formData';

// Keep existing mock setup
const defaultMockLoadFormData = jest.fn(({ formData }: { formData: unknown }) =>
  Promise.resolve(formData),
);

type MockLoadFormData =
  | typeof defaultMockLoadFormData
  | jest.Mock<Promise<unknown>, unknown[]>;

let mockLoadFormData: MockLoadFormData = defaultMockLoadFormData;

function createPromise<T>(input: T) {
  return Promise.resolve(input);
}

function createArrayPromise<T>(input: T) {
  return Promise.resolve([input]);
}

const mockLoadDatasource = jest.fn<Promise<unknown>, unknown[]>(createPromise);
const mockLoadQueryData = jest.fn<Promise<unknown>, unknown[]>(
  createArrayPromise,
);

const actual = jest.requireActual('../../../src/chart/clients/ChartClient');
jest.spyOn(actual, 'default').mockImplementation(() => ({
  loadDatasource: mockLoadDatasource,
  loadFormData: mockLoadFormData,
  loadQueryData: mockLoadQueryData,
}));

const ChartClientMock = ChartClient as jest.Mock<ChartClient>;

describe('ChartDataProvider', () => {
  beforeEach(() => {
    ChartClientMock.mockClear();
    mockLoadFormData = defaultMockLoadFormData;
    mockLoadFormData.mockClear();
    mockLoadDatasource.mockClear();
    mockLoadQueryData.mockClear();
  });

  const props: ChartDataProviderProps = {
    formData: { ...bigNumberFormData },
    children: ({ loading, payload, error }) => (
      <div>
        {loading && <span role="status">Loading...</span>}
        {payload && <pre role="contentinfo">{JSON.stringify(payload)}</pre>}
        {error && <div role="alert">{error.message}</div>}
      </div>
    ),
  };

  function setup(overrideProps?: Partial<ChartDataProviderProps>) {
    return render(<ChartDataProvider {...props} {...overrideProps} />);
  }

  it('instantiates a new ChartClient()', () => {
    setup();
    expect(ChartClientMock).toHaveBeenCalledTimes(1);
  });

  describe('ChartClient.loadFormData', () => {
    it('calls method on mount', () => {
      setup();
      expect(mockLoadFormData).toHaveBeenCalledTimes(1);
      expect(mockLoadFormData.mock.calls[0][0]).toEqual({
        sliceId: props.sliceId,
        formData: props.formData,
      });
    });

    it('should pass formDataRequestOptions to ChartClient.loadFormData', () => {
      const options = { host: 'override' };
      setup({ formDataRequestOptions: options });
      expect(mockLoadFormData).toHaveBeenCalledTimes(1);
      expect(mockLoadFormData.mock.calls[0][1]).toEqual(options);
    });

    it('calls ChartClient.loadFormData when formData or sliceId change', async () => {
      const { rerender } = setup();
      const newProps = { sliceId: 123, formData: undefined };
      expect(mockLoadFormData).toHaveBeenCalledTimes(1);

      rerender(<ChartDataProvider {...props} {...newProps} />);
      expect(mockLoadFormData).toHaveBeenCalledTimes(2);
      expect(mockLoadFormData.mock.calls[1][0]).toEqual(newProps);
    });
  });

  describe('ChartClient.loadDatasource', () => {
    it('does not call method if loadDatasource is false', async () => {
      setup({ loadDatasource: false });
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      expect(mockLoadDatasource).not.toHaveBeenCalled();
    });

    it('calls method on mount if loadDatasource is true', async () => {
      setup({ loadDatasource: true });
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      expect(mockLoadDatasource).toHaveBeenCalledTimes(1);
      expect(mockLoadDatasource.mock.calls[0]).toEqual([
        props.formData.datasource,
        undefined,
      ]);
    });

    it('should pass datasourceRequestOptions to ChartClient.loadDatasource', async () => {
      const options = { host: 'override' };
      setup({ loadDatasource: true, datasourceRequestOptions: options });
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      expect(mockLoadDatasource).toHaveBeenCalledTimes(1);
      expect(mockLoadDatasource.mock.calls[0][1]).toEqual(options);
    });

    it('calls ChartClient.loadDatasource if loadDatasource is true and formData or sliceId change', async () => {
      const { rerender } = setup({ loadDatasource: true });
      const newDatasource = 'test';

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await act(async () => {
        rerender(
          <ChartDataProvider
            {...props}
            formData={{ ...props.formData, datasource: newDatasource }}
            loadDatasource
          />,
        );
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(mockLoadDatasource).toHaveBeenCalledTimes(2);
      expect(mockLoadDatasource.mock.calls[0]).toEqual([
        props.formData.datasource,
        undefined,
      ]);
      expect(mockLoadDatasource.mock.calls[1]).toEqual([
        newDatasource,
        undefined,
      ]);
    });
  });

  describe('ChartClient.loadQueryData', () => {
    it('calls method on mount', async () => {
      setup();
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      expect(mockLoadQueryData).toHaveBeenCalledTimes(1);
      expect(mockLoadQueryData.mock.calls[0]).toEqual([
        props.formData,
        undefined,
      ]);
    });

    it('should pass queryDataRequestOptions to ChartClient.loadQueryData', async () => {
      const options = { host: 'override' };
      setup({ queryRequestOptions: options });
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      expect(mockLoadQueryData).toHaveBeenCalledTimes(1);
      expect(mockLoadQueryData).toHaveBeenCalledWith(
        expect.anything(),
        options,
      );
    });

    it('calls ChartClient.loadQueryData when formData or sliceId change', async () => {
      const { rerender } = setup();
      const newFormData = { key: 'test' };

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await act(async () => {
        rerender(<ChartDataProvider {...props} formData={newFormData} />);
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(mockLoadQueryData).toHaveBeenCalledTimes(2);
      expect(mockLoadQueryData.mock.calls[0]).toEqual([
        props.formData,
        undefined,
      ]);
      expect(mockLoadQueryData.mock.calls[1]).toEqual([newFormData, undefined]);
    });
  });

  describe('children', () => {
    it('shows loading state initially', async () => {
      mockLoadFormData.mockImplementation(() => new Promise(() => {}));
      mockLoadQueryData.mockImplementation(() => new Promise(() => {}));
      mockLoadDatasource.mockImplementation(() => new Promise(() => {}));

      setup();
      await screen.findByRole('status');
    });

    it('shows payload when loaded', async () => {
      mockLoadFormData.mockResolvedValue(props.formData);
      mockLoadQueryData.mockResolvedValue([props.formData]);
      mockLoadDatasource.mockResolvedValue(props.formData.datasource);

      setup({ loadDatasource: true });

      const payloadElement = await screen.findByRole('contentinfo');
      const actualPayload = JSON.parse(payloadElement.textContent || '');

      expect(actualPayload).toEqual({
        formData: props.formData,
        datasource: props.formData.datasource,
        queriesData: [props.formData],
      });
    });

    it('shows error message upon request error', async () => {
      const errorMessage = 'error';
      mockLoadFormData.mockRejectedValue(new Error(errorMessage));

      setup();

      const errorElement = await screen.findByRole('alert');
      expect(errorElement).toHaveAttribute('role', 'alert');
      expect(errorElement).toHaveTextContent(errorMessage);
    });

    it('shows error message upon JS error', async () => {
      mockLoadFormData.mockImplementation(() => {
        throw new Error('non-async error');
      });

      setup();

      const errorElement = await screen.findByRole('alert');
      expect(errorElement).toHaveAttribute('role', 'alert');
      expect(errorElement).toHaveTextContent('non-async error');
    });
  });

  describe('callbacks', () => {
    it('calls onLoaded when loaded', async () => {
      const onLoaded = jest.fn();
      mockLoadFormData.mockResolvedValue(props.formData);
      mockLoadQueryData.mockResolvedValue([props.formData]);
      mockLoadDatasource.mockResolvedValue(props.formData.datasource);

      setup({ onLoaded, loadDatasource: true });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(onLoaded).toHaveBeenCalledTimes(1);
      expect(onLoaded).toHaveBeenCalledWith({
        formData: props.formData,
        datasource: props.formData.datasource,
        queriesData: [props.formData],
      });
    });

    it('calls onError upon request error', async () => {
      const onError = jest.fn();
      mockLoadFormData.mockRejectedValue(new Error('error'));

      setup({ onError });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(new Error('error'));
    });

    it('calls onError upon JS error', async () => {
      const onError = jest.fn();
      mockLoadFormData.mockImplementation(() => {
        throw new Error('non-async error');
      });

      setup({ onError });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(new Error('non-async error'));
    });
  });
});
