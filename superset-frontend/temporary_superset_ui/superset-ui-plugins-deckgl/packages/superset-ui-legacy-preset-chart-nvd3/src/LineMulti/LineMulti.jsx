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
/* eslint-disable sort-keys, react/require-default-props, react/forbid-prop-types */
/* eslint-disable promise/always-return, promise/catch-or-return */
import d3 from 'd3';
import React from 'react';
import PropTypes from 'prop-types';
import { getExploreLongUrl } from '../vendor/superset/exploreUtils';
import ReactNVD3 from '../ReactNVD3';
import transformProps from '../transformProps';

const propTypes = {
  width: PropTypes.number,
  height: PropTypes.number,
  annotationData: PropTypes.object,
  datasource: PropTypes.object,
  formData: PropTypes.object,
  onAddFilter: PropTypes.func,
  onError: PropTypes.func,
};
const defaultProps = {
  onAddFilter() {},
  onError() {},
};

function getJson(url) {
  return new Promise((resolve, reject) => {
    d3.json(url, (error, response) => {
      if (error) {
        reject(error);
      } else {
        resolve(response.data);
      }
    });
  });
}

/*
 * Show multiple line charts
 *
 * This visualization works by fetching the data from each of the saved
 * charts, building the queryData data and passing it along to nvd3Vis.
 */
class LineMulti extends React.Component {
  constructor(props) {
    super(props);
    this.state = { queryData: [] };
  }

  componentDidMount() {
    this.loadData(this.props);
  }

  componentWillReceiveProps(nextProps) {
    this.loadData(nextProps);
  }

  loadData(props) {
    const { formData, queryData } = props;
    const { slices } = queryData.data;
    const {
      extraFilters,
      filters,
      lineCharts,
      lineCharts2,
      prefixMetricWithSliceName,
      timeRange,
    } = formData;

    this.setState({ queryData: [] });

    // fetch data from all the charts
    const subslices = [
      ...slices.axis1.map(subslice => [1, subslice]),
      ...slices.axis2.map(subslice => [2, subslice]),
    ];

    const promises = subslices.map(([yAxis, subslice]) => {
      const subsliceFormData = subslice.form_data;
      const combinedFormData = {
        ...subslice.form_data,
        extra_filters: extraFilters || [],
        filters: (subsliceFormData.filters || []).concat(filters || []),
        time_range: timeRange,
      };
      const addPrefix = prefixMetricWithSliceName;

      return getJson(getExploreLongUrl(combinedFormData, 'json')).then(data =>
        data.map(({ key, values }) => ({
          key: addPrefix ? `${subslice.slice_name}: ${key}` : key,
          type: combinedFormData.viz_type,
          values,
          yAxis,
        })),
      );
    });

    Promise.all(promises).then(data => {
      const queryDataCopy = { ...queryData };
      queryDataCopy.data = [].concat(...data);

      // add null values at the edges to fix multiChart bug when series with
      // different x values use different y axes
      if (lineCharts.length && lineCharts2.length) {
        let minX = Infinity;
        let maxX = -Infinity;
        queryDataCopy.data.forEach(datum => {
          minX = Math.min(minX, ...datum.values.map(v => v.x));
          maxX = Math.max(maxX, ...datum.values.map(v => v.x));
        });
        // add null values at the edges
        queryDataCopy.data.forEach(datum => {
          datum.values.push({ x: minX, y: null });
          datum.values.push({ x: maxX, y: null });
        });
      }

      this.setState({ queryData: queryDataCopy });
    });
  }

  render() {
    const {
      width,
      height,
      annotationData,
      datasource,
      formData,
      onAddFilter,
      onError,
    } = this.props;
    const { queryData } = this.state;

    return (
      <ReactNVD3
        {...transformProps({
          width,
          height,
          annotationData,
          datasource,
          formData,
          onError,
          onAddFilter,
          queryData,
        })}
      />
    );
  }
}

LineMulti.propTypes = propTypes;
LineMulti.defaultProps = defaultProps;

export default LineMulti;
