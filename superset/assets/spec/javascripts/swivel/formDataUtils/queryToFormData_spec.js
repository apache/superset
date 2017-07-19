import 'mocha';
import { expect, assert } from 'chai';
import * as data from './data';

import { convertQuerySettingsToFormData } from '../../../../javascripts/swivel/formDataUtils/convertToFormData';


describe('QuerySettings to FormData Converter', () => {
  describe('Convert Time ', () => {
    it('converts time sql', () => {
      const settings = data.QUERY_SETTINGS.getNextState({ datasource: '3__table' });
      const formData = convertQuerySettingsToFormData(settings);
      expect(formData).to.deep.include(data.FORM_DATA_TIME);
      assert.ok(!formData.granularity);
      assert.equal(formData.granularity_sqla, 'ds');
      assert.equal(formData.time_grain_sqla, 'month');
    });
    it('converts time druid', () => {
      const settings = data.QUERY_SETTINGS.getNextState({ datasource: '3__druid' });
      const formData = convertQuerySettingsToFormData(settings);
      expect(formData).to.deep.include(data.FORM_DATA_TIME);
      assert.equal(formData.granularity, 'month');
      assert.ok(!formData.granularity_sqla);
      assert.ok(!formData.time_grain_sqla);
    });
  });
  describe('General', () => {
    it('Genearal with time split', () => {
      const settings = data.QUERY_SETTINGS.getNextState({ datasource: '3__table' });
      const formData = convertQuerySettingsToFormData(settings);
      expect(formData).to.deep.include(data.FORM_DATA_GENERAL);
    });
    it('Genearal without time split', () => {
      const settings = data.QUERY_SETTINGS.getNextState({
        datasource: '3__table',
        splits: [],
      });
      const formData = convertQuerySettingsToFormData(settings);
      expect(formData).to.deep.include({ row_limit: 5 });
    });
    it('GroupBys', () => {
      const settings = data.QUERY_SETTINGS.getNextState({ datasource: '3__table' });
      settings.splits = data.QUERY_SETTINGS_GROUPBYS;
      const formData = convertQuerySettingsToFormData(settings);
      expect(formData.groupby).to.have.members(data.FORM_DATA_GROUPBY);
    });
    it('Metrics', () => {
      const settings = data.QUERY_SETTINGS.getNextState({ datasource: '3__table' });
      const formData = convertQuerySettingsToFormData(settings);
      expect(formData.metrics).to.have.members(Object.keys(settings.metrics));
    });
  });
  describe('Convert Filters', () => {
    it('SQL Filters', () => {
      const settings = data.QUERY_SETTINGS.getNextState({ datasource: '3__table' });
      settings.filters.push(...data.QUERY_SETTINGS_FILTERS);
      const formData = convertQuerySettingsToFormData(settings);
      const formDataFilters = formData.filters.reduce((lookup, f) => {
        if (lookup[f.col]) {
          lookup[f.col].push(f);
          return lookup;
        }
        return { ...lookup, [f.col]: [f] };
      }, {});

      const testsSingle = [
        ['equal_num', data.FORM_DATA_FILTER_EQUAL_NUM],
        ['not_equal_num', data.FORM_DATA_FILTER_NOT_EQUAL_NUM],
        ['equal_str', data.FORM_DATA_FILTER_EQUAL_STR],
        ['not_equal_str', data.FORM_DATA_FILTER_NOT_EQUAL_STR],
        ['like', data.FORM_DATA_FILTER_LIKE],
        ['not_like', data.FORM_DATA_FILTER_NOT_LIKE],
        ['in', data.FORM_DATA_FILTER_IN],
        ['not_in', data.FORM_DATA_FILTER_NOT_IN],
        ['less_then', data.FORM_DATA_FILTER_LESS_THEN],
        ['less_eq_then', data.FORM_DATA_FILTER_LESS_EQ_THEN],
        ['greater_then', data.FORM_DATA_FILTER_GREATER_THEN],
        ['greater_eq_then', data.FORM_DATA_FILTER_GREATER_EQ_THEN],
      ];
      for (const t of testsSingle) {
        expect(t[1]).to.deep.include(formDataFilters[t[0]][0], t[0]);
      }
      const testsInterval = [
        ['in_between_open', data.FORM_DATA_FILTER_IN_BETWEEN_OPEN],
        ['in_between_closed', data.FORM_DATA_FILTER_IN_BETWEEN_CLOSED],
      ];
      for (const t of testsInterval) {
        expect(t[1]).to.have.deep.members(formDataFilters[t[0]], t[0]);
      }
    });

    it('Druid Filters', () => {
      const settings = data.QUERY_SETTINGS.getNextState({ datasource: '3__druid' });
      settings.filters.push(...data.QUERY_SETTINGS_FILTERS);
      const formData = convertQuerySettingsToFormData(settings);
      const formDataFilters = formData.filters.reduce((lookup, f) => {
        if (lookup[f.col]) {
          lookup[f.col].push(f);
          return lookup;
        }
        return { ...lookup, [f.col]: [f] };
      }, {});

      // TODO Implement REGEX
      const testsSingle = [
        ['like', data.FORM_DATA_FILTER_REGEX],
      ];
      for (const t of testsSingle) {
        expect(t[1]).to.deep.include(formDataFilters[t[0]][0], t[0]);
      }
    });
  });
});
