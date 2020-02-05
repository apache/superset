import React from 'react';
import { shallow } from 'enzyme';
import ChartClient from '../../src/clients/ChartClient';
import ChartDataProvider, { Props } from '../../src/components/ChartDataProvider';
import { bigNumberFormData } from '../fixtures/formData';

// Note: the mock implentatino of these function directly affects the expected results below
const defaultMockLoadFormData = jest.fn(allProps => Promise.resolve(allProps.formData));

// coerce here else get: Type 'Mock<Promise<any>, []>' is not assignable to type 'Mock<Promise<any>, any[]>'
let mockLoadFormData = defaultMockLoadFormData as jest.Mock<Promise<any>, any>;
const mockLoadDatasource = jest.fn(datasource => Promise.resolve(datasource)) as jest.Mock<
  Promise<any>,
  any
>;
const mockLoadQueryData = jest.fn(input => Promise.resolve(input)) as jest.Mock<Promise<any>, any>;

// ChartClient is now a mock
jest.mock('../../src/clients/ChartClient', () =>
  jest.fn().mockImplementation(() => ({
    loadDatasource: mockLoadDatasource,
    loadFormData: mockLoadFormData,
    loadQueryData: mockLoadQueryData,
  })),
);

const ChartClientMock = ChartClient as jest.Mock<ChartClient>;

describe('ChartDataProvider', () => {
  beforeEach(() => {
    ChartClientMock.mockClear();

    mockLoadFormData = defaultMockLoadFormData;
    mockLoadFormData.mockClear();
    mockLoadDatasource.mockClear();
    mockLoadQueryData.mockClear();
  });

  const props: Props = {
    formData: { ...bigNumberFormData },
    children: () => <div />,
  };

  function setup(overrideProps?: Partial<Props>) {
    return shallow(<ChartDataProvider {...props} {...overrideProps} />);
  }

  it('instantiates a new ChartClient()', () => {
    setup();
    expect(ChartClientMock).toHaveBeenCalledTimes(1);
  });

  describe('ChartClient.loadFormData', () => {
    it('calls method on mount', () => {
      setup();
      expect(mockLoadFormData.mock.calls).toHaveLength(1);
      expect(mockLoadFormData.mock.calls[0][0]).toEqual({
        sliceId: props.sliceId,
        formData: props.formData,
      });
    });

    it('should pass formDataRequestOptions to ChartClient.loadFormData', () => {
      const options = { host: 'override' };
      setup({ formDataRequestOptions: options });
      expect(mockLoadFormData.mock.calls).toHaveLength(1);
      expect(mockLoadFormData.mock.calls[0][1]).toEqual(options);
    });

    it('calls ChartClient.loadFormData when formData or sliceId change', () => {
      const wrapper = setup();
      const newProps = { sliceId: 123, formData: undefined };
      expect(mockLoadFormData.mock.calls).toHaveLength(1);

      wrapper.setProps(newProps);
      expect(mockLoadFormData.mock.calls).toHaveLength(2);
      expect(mockLoadFormData.mock.calls[1][0]).toEqual(newProps);
    });
  });

  describe('ChartClient.loadDatasource', () => {
    it('does not method if loadDatasource is false', () => {
      return new Promise(done => {
        expect.assertions(1);
        setup({ loadDatasource: false });
        setTimeout(() => {
          expect(mockLoadDatasource.mock.calls).toHaveLength(0);
          done();
        }, 0);
      });
    });

    it('calls method on mount if loadDatasource is true', () => {
      return new Promise(done => {
        expect.assertions(2);
        setup({ loadDatasource: true });
        setTimeout(() => {
          expect(mockLoadDatasource.mock.calls).toHaveLength(1);
          expect(mockLoadDatasource.mock.calls[0][0]).toEqual(props.formData!.datasource);
          done();
        }, 0);
      });
    });

    it('should pass datasourceRequestOptions to ChartClient.loadDatasource', () => {
      return new Promise(done => {
        expect.assertions(2);
        const options = { host: 'override' };
        setup({ loadDatasource: true, datasourceRequestOptions: options });
        setTimeout(() => {
          expect(mockLoadDatasource.mock.calls).toHaveLength(1);
          expect(mockLoadDatasource.mock.calls[0][1]).toEqual(options);
          done();
        }, 0);
      });
    });

    it('calls ChartClient.loadDatasource if loadDatasource is true and formData or sliceId change', () => {
      return new Promise(done => {
        expect.assertions(3);
        const newDatasource = 'test';
        const wrapper = setup({ loadDatasource: true });
        wrapper.setProps({ formData: { datasource: newDatasource }, sliceId: undefined });

        setTimeout(() => {
          expect(mockLoadDatasource.mock.calls).toHaveLength(2);
          expect(mockLoadDatasource.mock.calls[0][0]).toEqual(props.formData!.datasource);
          expect(mockLoadDatasource.mock.calls[1][0]).toEqual(newDatasource);
          done();
        }, 0);
      });
    });
  });

  describe('ChartClient.loadQueryData', () => {
    it('calls method on mount', () => {
      return new Promise(done => {
        expect.assertions(2);
        setup();
        setTimeout(() => {
          expect(mockLoadQueryData.mock.calls).toHaveLength(1);
          expect(mockLoadQueryData.mock.calls[0][0]).toEqual(props.formData);
          done();
        }, 0);
      });
    });

    it('should pass queryDataRequestOptions to ChartClient.loadQueryData', () => {
      return new Promise(done => {
        expect.assertions(2);
        const options = { host: 'override' };
        setup({ queryRequestOptions: options });
        setTimeout(() => {
          expect(mockLoadQueryData.mock.calls).toHaveLength(1);
          expect(mockLoadQueryData.mock.calls[0][1]).toEqual(options);
          done();
        }, 0);
      });
    });

    it('calls ChartClient.loadQueryData when formData or sliceId change', () => {
      return new Promise(done => {
        expect.assertions(3);
        const newFormData = { key: 'test' };
        const wrapper = setup();
        wrapper.setProps({ formData: newFormData, sliceId: undefined });

        setTimeout(() => {
          expect(mockLoadQueryData.mock.calls).toHaveLength(2);
          expect(mockLoadQueryData.mock.calls[0][0]).toEqual(props.formData);
          expect(mockLoadQueryData.mock.calls[1][0]).toEqual(newFormData);
          done();
        }, 0);
      });
    });
  });

  describe('children', () => {
    it('calls children({ loading: true }) when loading', () => {
      const children = jest.fn();
      setup({ children });

      // during the first tick (before more promises resolve) loading is true
      expect(children.mock.calls).toHaveLength(1);
      expect(children.mock.calls[0][0]).toEqual({ loading: true });
    });

    it('calls children({ payload }) when loaded', () => {
      return new Promise(done => {
        expect.assertions(2);
        const children = jest.fn();
        setup({ children, loadDatasource: true });

        setTimeout(() => {
          expect(children.mock.calls).toHaveLength(2);
          expect(children.mock.calls[1][0]).toEqual({
            payload: {
              formData: props.formData,
              datasource: props.formData!.datasource,
              queryData: props.formData,
            },
          });
          done();
        }, 0);
      });
    });

    it('calls children({ error }) upon request error', () => {
      return new Promise(done => {
        expect.assertions(2);
        const children = jest.fn();
        mockLoadFormData = jest.fn(() => Promise.reject(new Error('error')));

        setup({ children });

        setTimeout(() => {
          expect(children.mock.calls).toHaveLength(2); // loading + error
          expect(children.mock.calls[1][0]).toEqual({ error: new Error('error') });
          done();
        }, 0);
      });
    });

    it('calls children({ error }) upon JS error', () => {
      return new Promise(done => {
        expect.assertions(2);
        const children = jest.fn();

        mockLoadFormData = jest.fn(() => {
          throw new Error('non-async error');
        });

        setup({ children });

        setTimeout(() => {
          expect(children.mock.calls).toHaveLength(2); // loading + error
          expect(children.mock.calls[1][0]).toEqual({ error: new Error('non-async error') });
          done();
        }, 0);
      });
    });
  });

  describe('callbacks', () => {
    it('calls onLoad(payload) when loaded', () => {
      return new Promise(done => {
        expect.assertions(2);
        const onLoaded = jest.fn();
        setup({ onLoaded, loadDatasource: true });

        setTimeout(() => {
          expect(onLoaded.mock.calls).toHaveLength(1);
          expect(onLoaded.mock.calls[0][0]).toEqual({
            formData: props.formData,
            datasource: props.formData!.datasource,
            queryData: props.formData,
          });
          done();
        }, 0);
      });
    });

    it('calls onError(error) upon request error', () => {
      return new Promise(done => {
        expect.assertions(2);
        const onError = jest.fn();
        mockLoadFormData = jest.fn(() => Promise.reject(new Error('error')));

        setup({ onError });
        setTimeout(() => {
          expect(onError.mock.calls).toHaveLength(1);
          expect(onError.mock.calls[0][0]).toEqual(new Error('error'));
          done();
        }, 0);
      });
    });

    it('calls onError(error) upon JS error', () => {
      return new Promise(done => {
        expect.assertions(2);
        const onError = jest.fn();

        mockLoadFormData = jest.fn(() => {
          throw new Error('non-async error');
        });

        setup({ onError });
        setTimeout(() => {
          expect(onError.mock.calls).toHaveLength(1);
          expect(onError.mock.calls[0][0]).toEqual(new Error('non-async error'));
          done();
        }, 0);
      });
    });
  });
});
