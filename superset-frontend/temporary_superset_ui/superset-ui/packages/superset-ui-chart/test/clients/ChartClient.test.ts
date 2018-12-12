import fetchMock from 'fetch-mock';
import { SupersetClientClass, SupersetClient } from '@superset-ui/connection';

import { ChartClient, getChartBuildQueryRegistry, buildQueryContext, FormData } from '../../src';
import { LOGIN_GLOB } from '../../../superset-ui-connection/test/fixtures/constants';

describe('ChartClient', () => {
  let chartClient;

  beforeAll(() => {
    fetchMock.get(LOGIN_GLOB, { csrf_token: '1234' });
    SupersetClient.reset();
    SupersetClient.configure().init();
  });

  beforeEach(() => {
    chartClient = new ChartClient();
  });

  afterEach(fetchMock.restore);

  describe('new ChartClient(config)', () => {
    it('creates a client without argument', () => {
      expect(chartClient).toBeInstanceOf(ChartClient);
    });
    it('creates a client with specified config.client', () => {
      const customClient = new SupersetClientClass();
      chartClient = new ChartClient({ client: customClient });
      expect(chartClient).toBeInstanceOf(ChartClient);
      expect(chartClient.client).toBe(customClient);
    });
  });

  describe('.loadFormData({ sliceId, formData }, options)', () => {
    it('fetches formData if given only sliceId', () => {
      fetchMock.get('glob:*/api/v1/formData/?slice_id=123', {
        form_data: {
          granularity: 'minute',
          field1: 'abc',
          field2: 'def',
        },
      });

      return expect(chartClient.loadFormData({ sliceId: 123 })).resolves.toEqual({
        granularity: 'minute',
        field1: 'abc',
        field2: 'def',
      });
    });
    it('fetches formData from sliceId and merges with specify formData if both fields are specified', () => {
      fetchMock.get('glob:*/api/v1/formData/?slice_id=123', {
        form_data: {
          granularity: 'minute',
          field1: 'abc',
          field2: 'def',
        },
      });

      return expect(
        chartClient.loadFormData({
          sliceId: 123,
          formData: {
            field2: 'ghi',
            field3: 'jkl',
          },
        }),
      ).resolves.toEqual({
        granularity: 'minute',
        field1: 'abc',
        field2: 'ghi',
        field3: 'jkl',
      });
    });
    it('returns promise of formData if only formData was given', () =>
      expect(
        chartClient.loadFormData({
          formData: {
            field1: 'abc',
            field2: 'def',
          },
        }),
      ).resolves.toEqual({
        field1: 'abc',
        field2: 'def',
      }));
    it('rejects if none of sliceId or formData is specified', () =>
      expect(chartClient.loadFormData({})).rejects.toEqual(
        new Error('At least one of sliceId or formData must be specified'),
      ));
  });

  describe('.loadQueryData(formData, options)', () => {
    it('returns a promise of query data for known chart type', () => {
      getChartBuildQueryRegistry().registerValue('word_cloud', (formData: FormData) =>
        buildQueryContext(formData),
      );
      fetchMock.post('glob:*/api/v1/query/', {
        field1: 'abc',
        field2: 'def',
      });

      return expect(
        chartClient.loadQueryData({
          granularity: 'minute',
          viz_type: 'word_cloud',
          datasource: '1__table',
          field3: 'abc',
          field4: 'def',
        }),
      ).resolves.toEqual({
        field1: 'abc',
        field2: 'def',
      });
    });
    it('returns a promise that rejects for unknown chart type', () =>
      expect(
        chartClient.loadQueryData({
          granularity: 'minute',
          viz_type: 'rainbow_3d_pie',
          datasource: '1__table',
          field3: 'abc',
          field4: 'def',
        }),
      ).rejects.toEqual(new Error('Unknown chart type: rainbow_3d_pie')));
  });

  describe('.loadDatasource(datasourceKey, options)', () => {
    it('fetches datasource', () => {
      fetchMock.get('glob:*/superset/fetch_datasource_metadata?datasourceKey=1__table', {
        field1: 'abc',
        field2: 'def',
      });
      expect(chartClient.loadDatasource('1__table')).resolves.toEqual({
        field1: 'abc',
        field2: 'def',
      });
    });
  });

  describe('.loadAnnotation(annotationLayer)', () => {
    it('returns an empty object if the annotation layer does not require query', () =>
      expect(
        chartClient.loadAnnotation({
          name: 'my-annotation',
        }),
      ).resolves.toEqual({}));
    it('otherwise returns a rejected promise because it is not implemented yet', () =>
      expect(
        chartClient.loadAnnotation({
          name: 'my-annotation',
          sourceType: 'abc',
        }),
      ).rejects.toEqual(new Error('This feature is not implemented yet.')));
  });

  describe('.loadAnnotations(annotationLayers)', () => {
    it('loads multiple annotation layers and combine results', () =>
      expect(
        chartClient.loadAnnotations([
          {
            name: 'anno1',
          },
          {
            name: 'anno2',
          },
          {
            name: 'anno3',
          },
        ]),
      ).resolves.toEqual({
        anno1: {},
        anno2: {},
        anno3: {},
      }));
    it('returns an empty object if input is not an array', () =>
      expect(chartClient.loadAnnotations()).resolves.toEqual({}));
    it('returns an empty object if input is an empty array', () =>
      expect(chartClient.loadAnnotations()).resolves.toEqual({}));
  });

  describe('.loadChartData({ sliceId, formData })', () => {
    it('loadAllDataNecessaryForAChart', () => {
      fetchMock.get('glob:*/api/v1/formData/?slice_id=10120', {
        form_data: {
          granularity: 'minute',
          viz_type: 'line',
          datasource: '1__table',
          color: 'living-coral',
        },
      });

      fetchMock.get('glob:*/superset/fetch_datasource_metadata?datasourceKey=1__table', {
        name: 'transactions',
        schema: 'staging',
      });

      fetchMock.post('glob:*/api/v1/query/', {
        lorem: 'ipsum',
        dolor: 'sit',
        amet: true,
      });

      getChartBuildQueryRegistry().registerValue('line', (formData: FormData) =>
        buildQueryContext(formData),
      );

      return expect(
        chartClient.loadChartData({
          sliceId: '10120',
        }),
      ).resolves.toEqual({
        annotationData: {},
        datasource: {
          name: 'transactions',
          schema: 'staging',
        },
        formData: {
          granularity: 'minute',
          viz_type: 'line',
          datasource: '1__table',
          color: 'living-coral',
        },
        queryData: {
          lorem: 'ipsum',
          dolor: 'sit',
          amet: true,
        },
      });
    });
  });
});
