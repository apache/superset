import React from 'react';
import PropTypes from 'prop-types';

import AdhocMetricOption from './AdhocMetricOption';
import AdhocMetric from '../AdhocMetric';
import columnType from '../propTypes/columnType';
import MetricOption from '../../components/MetricOption';

const propTypes = {
  option: PropTypes.object.isRequired,
  onMetricEdit: PropTypes.func,
  columns: PropTypes.arrayOf(columnType),
};

export default function MetricDefinitionValue({ option, onMetricEdit, columns }) {
  if (option.metric_name) {
    return (
      <MetricOption metric={option} />
    );
  } else if (option instanceof AdhocMetric) {
    return (
      <AdhocMetricOption adhocMetric={option} onMetricEdit={onMetricEdit} columns={columns} />
    );
  }
  console.error("You must supply either a saved metric or adhoc metric to MetricDefinitionValue");
  return null;
}
MetricDefinitionValue.propTypes = propTypes;
