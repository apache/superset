import React from 'react';
import PropTypes from 'prop-types';

import ColumnTypeLabel from '../../components/ColumnTypeLabel';
import adhocMetricType from '../propTypes/adhocMetricType';

const propTypes = {
  adhocMetric: adhocMetricType,
  showType: PropTypes.bool,
};

export default function AdhocMetricStaticOption({ adhocMetric, showType }) {
  return (
    <div>
      {showType && <ColumnTypeLabel type="expression" />}
      <span className="m-r-5 option-label">
        {adhocMetric.label}
      </span>
    </div>
  );
}
AdhocMetricStaticOption.propTypes = propTypes;
