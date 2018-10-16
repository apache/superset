import d3 from 'd3';
import React from 'react';
import PropTypes from 'prop-types';
import { getExploreLongUrl } from '../../../explore/exploreUtils';
import ReactNVD3 from '../ReactNVD3';
import transformProps from '../transformProps';

const propTypes = {
  width: PropTypes.number,
  height: PropTypes.number,
  annotationData: PropTypes.object,
  datasource: PropTypes.array,
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
 * charts, building the payload data and passing it along to nvd3Vis.
 */
class LineMulti extends React.Component {
  constructor(props) {
    super(props);
    this.state = { payload: [] };
  }

  componentDidMount() {
    this.loadData(this.props);
  }

  componentWillReceiveProps(nextProps) {
    this.loadData(nextProps);
  }

  loadData(props) {
    const { formData, payload } = props;
    const slices = payload.data.slices;
    const {
      extraFilters,
      filters,
      lineCharts,
      lineCharts2,
      prefixMetricWithSliceName,
      timeRange,
    } = formData;

    this.setState({ payload: [] });

    // fetch data from all the charts
    const subslices = [
      ...slices.axis1.map(subslice => [1, subslice]),
      ...slices.axis2.map(subslice => [2, subslice]),
    ];

    const promises = subslices.map(([yAxis, subslice]) => {
      const subsliceFormData = subslice.form_data;
      const combinedFormData = {
        ...subslice.form_data,
        filters: (subsliceFormData.filters || [])
          .concat(filters || [])
          .concat(extraFilters || []),
        time_range: timeRange,
      };
      const addPrefix = prefixMetricWithSliceName;
      return getJson(getExploreLongUrl(combinedFormData, 'json'))
        .then(data => data.map(({ key, values }) => ({
          key: addPrefix ? `${subslice.slice_name}: ${key}` : key,
          type: combinedFormData.viz_type,
          values,
          yAxis,
        })));
    });

    Promise.all(promises).then((data) => {
      const payloadCopy = { ...payload };
      payloadCopy.data = [].concat(...data);

      // add null values at the edges to fix multiChart bug when series with
      // different x values use different y axes
      if (lineCharts.length && lineCharts2.length) {
        let minX = Infinity;
        let maxX = -Infinity;
        payloadCopy.data.forEach((datum) => {
          minX = Math.min(minX, ...datum.values.map(v => v.x));
          maxX = Math.max(maxX, ...datum.values.map(v => v.x));
        });
        // add null values at the edges
        payloadCopy.data.forEach((datum) => {
          datum.values.push({ x: minX, y: null });
          datum.values.push({ x: maxX, y: null });
        });
      }

      this.setState({ payload: payloadCopy });
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
    const { payload } = this.state;

    return (
      <ReactNVD3
        width={width}
        height={height}
        {...transformProps({
          annotationData,
          datasource,
          formData,
          onError,
          onAddFilter,
          payload,
        })}
      />
    );
  }
}

LineMulti.propTypes = propTypes;
LineMulti.defaultProps = defaultProps;

export default LineMulti;
