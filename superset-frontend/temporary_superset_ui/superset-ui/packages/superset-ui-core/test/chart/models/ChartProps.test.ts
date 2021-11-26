import { ChartProps } from '@superset-ui/core/src';

const RAW_FORM_DATA = {
  some_field: 1,
};

const RAW_DATASOURCE = {
  column_formats: { test: '%s' },
};

const QUERY_DATA = { data: {} };
const QUERIES_DATA = [QUERY_DATA];

describe('ChartProps', () => {
  it('exists', () => {
    expect(ChartProps).toBeDefined();
  });
  describe('new ChartProps({})', () => {
    it('returns new instance', () => {
      const props = new ChartProps({
        width: 800,
        height: 600,
        formData: RAW_FORM_DATA,
        queriesData: QUERIES_DATA,
      });
      expect(props).toBeInstanceOf(ChartProps);
    });
    it('processes formData and datasource to convert field names to camelCase', () => {
      const props = new ChartProps({
        width: 800,
        height: 600,
        datasource: RAW_DATASOURCE,
        formData: RAW_FORM_DATA,
        queriesData: QUERIES_DATA,
      });
      expect(props.formData.someField as number).toEqual(1);
      expect(props.datasource.columnFormats).toEqual(RAW_DATASOURCE.column_formats);
      expect(props.rawFormData).toEqual(RAW_FORM_DATA);
      expect(props.rawDatasource).toEqual(RAW_DATASOURCE);
    });
  });
  describe('ChartProps.createSelector()', () => {
    const selector = ChartProps.createSelector();
    it('returns a selector function', () => {
      expect(selector).toBeInstanceOf(Function);
    });
    it('selector returns previous chartProps if all input fields do not change', () => {
      const props1 = selector({
        width: 800,
        height: 600,
        datasource: RAW_DATASOURCE,
        formData: RAW_FORM_DATA,
        queriesData: QUERIES_DATA,
      });
      const props2 = selector({
        width: 800,
        height: 600,
        datasource: RAW_DATASOURCE,
        formData: RAW_FORM_DATA,
        queriesData: QUERIES_DATA,
      });
      expect(props1).toBe(props2);
    });
    it('selector returns a new chartProps if some input fields change', () => {
      const props1 = selector({
        width: 800,
        height: 600,
        datasource: RAW_DATASOURCE,
        formData: RAW_FORM_DATA,
        queriesData: QUERIES_DATA,
      });
      const props2 = selector({
        width: 800,
        height: 600,
        datasource: RAW_DATASOURCE,
        formData: { new_field: 3 },
        queriesData: QUERIES_DATA,
      });
      const props3 = selector({
        width: 800,
        height: 600,
        datasource: RAW_DATASOURCE,
        formData: RAW_FORM_DATA,
        queriesData: QUERIES_DATA,
      });
      expect(props1).not.toBe(props2);
      expect(props1).not.toBe(props3);
    });
  });
});
