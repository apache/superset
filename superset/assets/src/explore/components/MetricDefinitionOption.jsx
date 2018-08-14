import React from 'react';
import PropTypes from 'prop-types';

import MetricOption from '../../components/MetricOption';
import ColumnOption from '../../components/ColumnOption';
import AggregateOption from './AggregateOption';
import columnType from '../propTypes/columnType';
import savedMetricType from '../propTypes/savedMetricType';
import aggregateOptionType from '../propTypes/aggregateOptionType';
import withToasts from '../../messageToasts/enhancers/withToasts';

const propTypes = {
  option: PropTypes.oneOfType([
    columnType,
    savedMetricType,
    aggregateOptionType,
  ]).isRequired,
  addWarningToast: PropTypes.func.isRequired,
};

function MetricDefinitionOption({ option, addWarningToast }) {
  if (option.metric_name) {
    return (
      <MetricOption metric={option} showType />
    );
  } else if (option.column_name) {
    return (
      <ColumnOption column={option} showType />
    );
  } else if (option.aggregate_name) {
    return (
      <AggregateOption aggregate={option} showType />
    );
  }
  addWarningToast('You must supply either a saved metric, column or aggregate to MetricDefinitionOption');
  return null;
}

MetricDefinitionOption.propTypes = propTypes;

export default withToasts(MetricDefinitionOption);
