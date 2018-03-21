import React from 'react';
import PropTypes from 'prop-types';

import AdhocMetricOption from './AdhocMetricOption';
import AdhocMetric from '../AdhocMetric';
import columnType from '../propTypes/columnType';
import MetricOption from '../../components/MetricOption';
import savedMetricType from '../propTypes/savedMetricType';
import adhocMetricType from '../propTypes/adhocMetricType';

const propTypes = {
  option: PropTypes.oneOfType([
    savedMetricType,
    adhocMetricType,
  ]).isRequired,
  onMetricEdit: PropTypes.func,
  columns: PropTypes.arrayOf(columnType),
  multi: PropTypes.bool,
  datasourceType: PropTypes.string,
};

export default function MetricDefinitionValue({
  option,
  onMetricEdit,
  columns,
  multi,
  datasourceType,
}) {
  if (option.metric_name) {
    return (
      <MetricOption metric={option} />
    );
  } else if (option instanceof AdhocMetric) {
    return (
      <AdhocMetricOption
        adhocMetric={option}
        onMetricEdit={onMetricEdit}
        columns={columns}
        multi={multi}
        datasourceType={datasourceType}
      />
    );
  }
  notify.error('You must supply either a saved metric or adhoc metric to MetricDefinitionValue');
  return null;
}
MetricDefinitionValue.propTypes = propTypes;
