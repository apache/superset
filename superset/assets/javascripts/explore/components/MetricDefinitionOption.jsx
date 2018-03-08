import React from 'react';
import PropTypes from 'prop-types';

import MetricOption from '../../components/MetricOption';
import ColumnOption from '../../components/ColumnOption';
import AggregateOption from './AggregateOption';

const propTypes = {
  option: PropTypes.object.isRequired,
};

export default function MetricDefinitionOption({ option }) {
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
  console.error("You must supply either a saved metric, column or aggregate to MetricDefinitionOption");
  return null;
}
MetricDefinitionOption.propTypes = propTypes;
