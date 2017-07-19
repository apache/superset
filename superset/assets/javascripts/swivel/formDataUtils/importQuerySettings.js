/* eslint camelcase: 0 */
import ColumnTypes from '../ColumnTypes';

class Column {
  constructor(...args) {
    this.columnType = null;
    this.id = '';
    this.name = '';
    Object.assign(this, ...args);
  }
}

class IntervalFilter extends Column {
  importFormData(term) {
    const op = term.op;
    if (!this.intervalStart) {
      this.intervalStart = '';
      this.leftOpen = false;
    }
    if (!this.intervalEnd) {
      this.intervalEnd = '';
      this.rightOpen = false;
    }
    if (op === '>') {
      this.id = term.col;
      this.intervalStart = term.val;
      this.leftOpen = true;
    } else if (op === '>=') {
      this.id = term.col;
      this.intervalStart = term.val;
      this.leftOpen = false;
    } else if (op === '<') {
      this.id = term.col;
      this.intervalEnd = term.val;
      this.rightOpen = true;
    } else if (op === '<=') {
      this.id = term.col;
      this.intervalEnd = term.val;
      this.rightOpen = false;
    } else {
      this.error = `The filter operation "${op}" on column` +
          `"${term.col}" is not supported.`;
    }
    return true;
  }
}

const explicitFilterOps = [
  '==', 'like', 'regex', '!=', 'not like', 'in', 'not in',
];

class ExplicitFilter extends Column {
  importFormData(term) {
    if (!Array.isArray(this.filter)) {
      this.filter = [];
    }
    this.invert = false;
    const op = term.op.toLowerCase();
    if (op === '==') {
      this.id = term.col;
      this.filter.push(term.val);
      this.invert = false;
      this.like = false;
    } else if (op === 'like' || op === 'regex') {
      this.id = term.col;
      this.filter.push(term.val);
      this.invert = false;
      this.like = true;
    } else if (op === '!=') {
      this.id = term.col;
      this.filter.push(term.val);
      this.invert = true;
      this.like = false;
    } else if (op === 'not like') {
      this.id = term.col;
      this.filter.push(term.val);
      this.invert = true;
      this.like = true;
    } else if (op === 'in') {
      this.filter.push(...term.val);
      this.invert = false;
    } else if (op === 'not in') {
      this.filter.push(...term.val);
      this.invert = true;
    } else {
      this.error = `This combination of filters on ${term.col}` +
          'is not supported.';
    }
    return true;
  }
}

export function importFormData(querySettingsStore, formData, refData) {
  const store = querySettingsStore;
  const isSql = formData.datasource.endsWith('__table');

  function convertVizFromFormData({ viz_type, datasource }) {
    store.datasource = datasource;
    store.vizType = viz_type;
  }

  function convertMetricsFromFormData(metrics) {
    if (metrics) {
      store.metrics = metrics.reduce((mets, m) => Object.assign(mets, { [m]: true }), {});
    }
  }

  function convertTime({ since, until,
                          granularity,
                          granularity_sqla,
                          time_grain_sqla,
                          include_time,
                          viz_type }) {
    let column;
    if (isSql) {
      column = refData.columns.find(m => m.columnType === ColumnTypes.TIMESTAMP &&
          m.id === granularity_sqla);
    }
    if (!column) {
      column = refData.columns.find(m => m.columnType === ColumnTypes.TIMESTAMP);
    }
    const t = new IntervalFilter(column);
    t.intervalStart = since;
    t.intervalEnd = until;
    store.filters.push(t);
    if (viz_type !== 'table' || include_time) {
      store.splits.push({
        ...column,
        granularity: isSql ? time_grain_sqla : granularity,
      });
    }
  }

  function convertFiltersFromFormData(filters, columns) {
    if (filters) {
      const grouped = filters.reduce((group, f) => {
        const g = group;
        if (g[f.col]) {
          g[f.col].push(f);
        } else {
          g[f.col] = [f];
        }
        return g;
      }, {});
      for (const id of Object.keys(grouped)) {
        const column = columns[id];
        const first = grouped[id][0].op.toLowerCase();
        if (explicitFilterOps.find(x => x === first)) {
          for (const term of grouped[id]) {
            const filter = new ExplicitFilter(column);
            filter.importFormData(term);
            store.filters.push(filter);
          }
        } else {
          if (grouped[id].length > 2) {
            store.setError('Only one interval filter per ' +
                `column supported; column id: ${first.col}`);
          }
          const filter = new IntervalFilter(column);
          for (const term of grouped[id]) {
            filter.importFormData(term);
          }
          store.filters.push(filter);
        }
      }
    }
  }

  function convertGroupBysFromFormData({ timeseries_limit_metric,
                                        order_desc,
                                        groupby,
                                        limit,
                                        row_limit,
                                        }, columns) {
    if (limit === undefined || limit === null) {
      store.limit = row_limit;
    } else if (row_limit === undefined || row_limit === null) {
      store.limit = limit;
    } else {
      store.limit = Math.min(limit, row_limit);
    }
    store.orderDesc = !!order_desc;
    store.orderBy = timeseries_limit_metric;
    if (groupby) {
      groupby.forEach(g => store.splits.push(columns[g]));
    }
  }

  const columns = refData.columns.reduce((cols, c) => Object.assign(cols, { [c.id]: c }), {});
  convertVizFromFormData(formData);
  convertTime(formData);
  convertFiltersFromFormData(formData.filters, columns);
  convertGroupBysFromFormData(formData, columns);
  convertMetricsFromFormData(formData.metrics);
  return store;
}
