/* eslint camelcase: 0 */
import ColumnTypes from '../ColumnTypes';
import { VIZ_TYPES } from '../../../visualizations/main';

export function isSupportedBySwivel(formData) {
  if (formData) {
    // not all query types are supported
    if (!!formData.having ||  // no support for SQL `having`
        !!formData.where ||  // no support for custom SQL `where` clause
        // no support of Druid `having filters`
        (Array.isArray(formData.having_filters) && !!formData.having_filters.length)) {
      return false;
    }
    // Supported time series charts
    if ((formData.viz_type === VIZ_TYPES.line ||
            formData.viz_type === VIZ_TYPES.area ||
            formData.viz_type === VIZ_TYPES.bar)
    ) return true;
    // Swivel only supports `grouped by` tables with metrics
    if (formData.viz_type === VIZ_TYPES.table &&
        Array.isArray(formData.metrics) &&
        !!formData.metrics.length) {
      return true;
    }
  }
  return false;
}


export function convertVizSettingsToFormData(vizSettings) {
  function convertPresentationToFormData() {
    return {
      show_legend: vizSettings.showLegend,
      rich_tooltip: vizSettings.richTooltip,
      separate_charts: vizSettings.separateCharts,

      bottom_margin: 0,
      color_scheme: 'bnbColors',
      line_interpolation: 'linear',

      x_axis_format: 'smart_date',
      // x_axis_showminmax: true,

      y_axis_format: '.3s',

      // y_axis_showminmax: true,
      y_log_scale: false,


      rightAlignYAxis: true,

      table_timestamp_format: 'smart_date',
      // This makes tables interactive
      table_filter: true,
      // Mandatory for exploreview:
      // LineChart:
      y_axis_bounds: [null, null],
    };
  }
  const formData = Object.assign({},
      convertPresentationToFormData(),
      );
  return formData;
}

export function convertQuerySettingsToFormData(querySettings) {
  let error;

  const isSql = querySettings.datasource.endsWith('__table');

  function convertMetricsToformData() {
    const metricIds = Object.keys(querySettings.metrics);
    if (!metricIds.length) {
      error = 'Please select at least one metric.';
      return {};
    }
    return { metrics: metricIds };
  }

  function convertGroupBysToformData() {
    const splits = querySettings.splits;
    const limit = querySettings.limit;
    const orderBy = querySettings.orderBy;
    const orderDesc = querySettings.orderDesc;

    const timesplit = splits.find(x => x.columnType === ColumnTypes.TIMESTAMP);
    let allSplits = splits;
    let granularity = null;
    if (timesplit) {
      allSplits = splits.filter(x => x.id !== timesplit.id);
      granularity = timesplit.granularity;
      if (!granularity) {
        error = 'Please set a granularity on your time `group by`.';
        return {};
      }
    } else if (querySettings.vizType !== 'table') {
      error = 'Please `group by` a time column.';
    }

    const groupby = allSplits.map(x => x.id);

    let rowLimit = null;
    if (!timesplit && limit) {
      rowLimit = limit;
    }

    const o = {
      include_time: !!granularity,
      timeseries_limit_metric: orderBy,
      order_desc: orderDesc,
      groupby,
      limit,
      row_limit: rowLimit,
    };

    if (querySettings.datasource.endsWith('__druid')) {
      o.granularity = granularity;
    } else {
      o.time_grain_sqla = granularity;
    }

    return o;
  }

  function convertFiltersToFormData() {
    const filters = querySettings.filters;

    const timefilter = filters.find(x => x.columnType === ColumnTypes.TIMESTAMP);
    if (timefilter && timefilter.intervalStart) {
      const since = timefilter.intervalStart;
      const until = timefilter.intervalEnd;

      const allFilters = filters.filter(x => x.id !== timefilter.id);
      const groupableFilters = allFilters.filter(x =>
          x.groupable);
      const intervalFilters = allFilters.filter(x =>
          !x.groupable);


      let outFilters = groupableFilters.map((x) => {
        let op;
        let val = x.filter || [];
        if (val.length > 1) {
          if (x.invert) {
            op = 'not in';
          } else {
            op = 'in';
          }
        } else if (val.length === 1) {
          val = val[0];
          if (x.columnType === ColumnTypes.STRING && !isSql) {
            if (x.invert) {
              op = '!=';
            } else if (x.like) {
              op = 'regex';
            } else {
              op = '==';
            }
          } else
          if (x.columnType === ColumnTypes.STRING) {
            if (x.like) {
              if (x.invert) {
                op = 'not like';
              } else {
                op = 'like';
              }
            } else if (x.invert) {
              op = '!=';
            } else {
              op = '==';
            }
          } else if (x.invert) {
            op = '!=';
          } else {
            op = '==';
          }
        }
        return {
          col: x.id,
          op,
          val,
        };
      });
      outFilters = outFilters.concat(intervalFilters.filter(x => x.intervalStart).map(x => ({
        col: x.id,
        op: x.leftOpen ? '>' : '>=',
        val: x.intervalStart,
      })));
      outFilters = outFilters.concat(intervalFilters.filter(x => x.intervalEnd).map(x => ({
        col: x.id,
        op: x.rightOpen ? '<' : '<=',
        val: x.intervalEnd,
      })));

      const o = {
        since,
        until,
        filters: outFilters,
      };

      if (querySettings.datasource.endsWith('__table')) {
        o.granularity_sqla = timefilter.id;
      }
      return o;
    }
    error = 'Please add a `filter` on a time column.';
    return {};
  }

  const formData = Object.assign({},
    {
      datasource: querySettings.datasource,
      viz_type: querySettings.vizType,
    },
      convertMetricsToformData(),
      convertFiltersToFormData(),
      convertGroupBysToformData(),
      );
  if (error) {
    formData.error = error;
  }
  return formData;
}

