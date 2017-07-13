import React from 'react';
import PropTypes from 'prop-types';

import InfoTooltipWithTrigger from './InfoTooltipWithTrigger';

const propTypes = {
  metric: PropTypes.object.isRequired,
};

export default function MetricOption({ metric }) {
  return (
    <div>
      <span className="m-r-5 option-label">
        {metric.verbose_name || metric.metric_name}
      </span>
      {metric.description &&
        <InfoTooltipWithTrigger
          className="m-r-5 text-muted"
          icon="info"
          tooltip={metric.description}
          label={`descr-${metric.metric_name}`}
        />
      }
      <InfoTooltipWithTrigger
        className="m-r-5 text-muted"
        icon="question-circle-o"
        tooltip={metric.expression}
        label={`expr-${metric.metric_name}`}
      />
    </div>);
}
MetricOption.propTypes = propTypes;
