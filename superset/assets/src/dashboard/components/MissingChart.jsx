import PropTypes from 'prop-types';
import React from 'react';

import Loading from '../../components/Loading';
import { t } from '../../locales';

const propTypes = {
  height: PropTypes.number.isRequired,
};

export default function MissingChart({ height }) {
  return (
    <div className="missing-chart-container" style={{ height: height + 20 }}>
      <div className="loading-container">
        <Loading />
      </div>
      <div className="missing-chart-body">
        {t(
          'There is no chart definition associated with this component, could it have been deleted?',
        )}
        <br />
        <br />
        {t('Delete this container and save to remove this message.')}
      </div>
    </div>
  );
}

MissingChart.propTypes = propTypes;
