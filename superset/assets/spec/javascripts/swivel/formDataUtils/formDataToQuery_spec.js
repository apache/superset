import 'mocha';
import { expect, assert } from 'chai';

import QuerySettingsStore from '../../../../javascripts/swivel/stores/QuerySettingsStore';
import * as data from './data';


import { importFormData } from '../../../../javascripts/swivel/formDataUtils/importQuerySettings';

describe('FormData Converter To QuerySettings', () => {
  describe('Convert Time ', () => {
    it('converts time sql', () => {
      const formData = data.FORM_DATA_SQL;
      const settings = importFormData(new QuerySettingsStore(), formData, data.REF_DATA);
      expect(settings.filters).to.have.deep.members(data.QUERY_SETTINGS.filters);
      expect(settings.splits).to.have.deep.members(data.QUERY_SETTINGS.splits);
    });
    it('converts time druid', () => {
      const formData = data.FORM_DATA_DRUID;
      const settings = importFormData(new QuerySettingsStore(), formData, data.REF_DATA);
      expect(settings.filters).to.have.deep.members(data.QUERY_SETTINGS.filters);
      expect(settings.splits).to.have.deep.members(data.QUERY_SETTINGS.splits);
    });
  });
  describe('General', () => {
    it('Genearal with time split', () => {
      const formData = data.FORM_DATA_SQL;
      const settings = importFormData(new QuerySettingsStore(), formData, data.REF_DATA);
      assert.equal(settings.orderDesc, formData.order_desc);
      assert.equal(settings.orderBy, formData.timeseries_limit_metric);
      assert.equal(settings.limit, formData.limit);
    });
    it('GroupBys', () => {
      const formData = data.FORM_DATA_SQL;
      formData.groupby = data.FORM_DATA_GROUPBY;
      const settings = importFormData(new QuerySettingsStore(), formData, data.REF_DATA);
      expect(settings.splits).to.contain.deep.members(data.QUERY_SETTINGS_GROUPBYS);
    });
    it('Metrics', () => {
      const formData = data.FORM_DATA_SQL;
      formData.groupby = data.FORM_DATA_GROUPBY;
      const settings = importFormData(new QuerySettingsStore(), formData, data.REF_DATA);
      expect(settings.metrics).to.include(data.QUERY_SETTINGS.metrics);
    });
  });
  describe('Convert Filters', () => {
    it('SQL Filters', () => {
      const formData = data.FORM_DATA_SQL;
      formData.filters = [
        data.FORM_DATA_FILTER_EQUAL_NUM, data.FORM_DATA_FILTER_NOT_EQUAL_NUM,
        data.FORM_DATA_FILTER_EQUAL_STR, data.FORM_DATA_FILTER_NOT_EQUAL_STR,
        data.FORM_DATA_FILTER_LIKE, data.FORM_DATA_FILTER_NOT_LIKE,
        data.FORM_DATA_FILTER_IN, data.FORM_DATA_FILTER_NOT_IN,
        data.FORM_DATA_FILTER_LESS_THEN, data.FORM_DATA_FILTER_LESS_EQ_THEN,
        data.FORM_DATA_FILTER_GREATER_THEN, data.FORM_DATA_FILTER_GREATER_EQ_THEN,
      ];
      formData.filters.push(...data.FORM_DATA_FILTER_IN_BETWEEN_OPEN);
      formData.filters.push(...data.FORM_DATA_FILTER_IN_BETWEEN_CLOSED);

      const settings = importFormData(new QuerySettingsStore(), formData, data.REF_DATA);
      expect(settings.filters).to.have.deep.members(
          data.QUERY_SETTINGS.filters.concat(data.QUERY_SETTINGS_FILTERS));
    });

    it('Druid Filters', () => {
      const formData = data.FORM_DATA_DRUID;
      formData.filters = [
        data.FORM_DATA_FILTER_REGEX,
      ];
      const settings = importFormData(new QuerySettingsStore(), formData, data.REF_DATA);
      expect(settings.filters).to.have.deep.members(
          data.QUERY_SETTINGS.filters.concat(data.QUERY_SETTINGS_FILTERS.filter(x => x.id === 'like')),
      );
    });
  });
});
