/* eslint-disable no-magic-numbers */
import React, { useState } from 'react';
import { SuperChart } from '@superset-ui/chart';
import { Props as SuperChartProps } from '@superset-ui/chart/lib/components/SuperChart';
import data from './data';
import birthNames from './birth_names.json';

import 'bootstrap/dist/css/bootstrap.min.css';

function paginated(props: SuperChartProps, pageSize = 50) {
  if (props.formData) {
    props.formData = {
      ...props.formData,
      page_length: pageSize,
    };
  }
  if (props.queryData?.form_data) {
    props.queryData.form_data = {
      ...props.queryData.form_data,
      page_length: pageSize,
    };
  }
  return {
    ...props,
  };
}

/**
 * Load sample data for testing
 * @param props the original props passed to SuperChart
 * @param pageSize number of records perpage
 * @param targetSize the target total number of records
 */
function loadData(props: SuperChartProps, pageSize = 50, targetSize = 10042) {
  if (!props.queryData) return props;
  const data = props.queryData && props.queryData.data;
  if (data.records.length > 0) {
    while (data.records.length < targetSize) {
      const records = data.records;
      data.records = records.concat(records).slice(0, targetSize);
    }
  }
  props.height = window.innerHeight - 130;
  return paginated(props, pageSize);
}

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="table"
        width={400}
        height={400}
        datasource={{
          columnFormats: {},
          verboseMap: {
            name: 'name',
            sum__num: 'sum__num',
          },
        }}
        filters={{}}
        queryData={{ data }}
        formData={{
          alignPn: false,
          colorPn: false,
          includeSearch: false,
          metrics: ['sum__num'],
          orderDesc: true,
          pageLength: 0,
          percentMetrics: [],
          tableFilter: false,
          tableTimestampFormat: '%Y-%m-%d %H:%M:%S',
          timeseriesLimitMetric: null,
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'legacy-|plugin-chart-table|TableChartPlugin',
  },
  {
    renderStory() {
      const [chartProps, setChartProps] = useState(loadData(birthNames));
      const updatePageSize = (size: number) => {
        setChartProps(paginated(chartProps, size));
      };
      return (
        <div className="superset-body">
          <div className="panel">
            <div className="panel-heading form-inline">
              Initial page size:{' '}
              <div className="btn-group">
                {[10, 25, 40, 50, 100, -1].map(pageSize => {
                  return (
                    <button
                      key={pageSize}
                      className="btn btn-default"
                      onClick={() => updatePageSize(pageSize)}
                    >
                      {pageSize > 0 ? pageSize : 'All'}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="panel-body">
              <SuperChart {...chartProps} chartType="table" />
            </div>
          </div>
        </div>
      );
    },
    storyName: 'Big Table',
    storyPath: 'legacy-|plugin-chart-table|TableChartPlugin',
  },
];
