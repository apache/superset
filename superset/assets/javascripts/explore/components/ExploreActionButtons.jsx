import React from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';
import URLShortLinkButton from './URLShortLinkButton';
import EmbedCodeButton from './EmbedCodeButton';
import DisplayQueryButton from './DisplayQueryButton';
import { t } from '../../locales';
import { exportChart } from '../exploreUtils';

const propTypes = {
  canDownload: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]).isRequired,
  slice: PropTypes.object,
  chartStatus: PropTypes.string,
  latestQueryFormData: PropTypes.object,
  queryResponse: PropTypes.object,
};

export default function ExploreActionButtons({
    canDownload, slice, chartStatus, latestQueryFormData, queryResponse }) {
  const exportToCSVClasses = cx('btn btn-default btn-sm', {
    'disabled disabledButton': !canDownload,
  });
  const doExportCSV = exportChart.bind(this, latestQueryFormData, 'csv');
  const doExportChart = exportChart.bind(this, latestQueryFormData, 'json');

  if (slice) {
    return (
      <div className="btn-group results" role="group">
        <URLShortLinkButton latestQueryFormData={latestQueryFormData} />

        <EmbedCodeButton latestQueryFormData={latestQueryFormData} />

        <a
          onClick={doExportChart}
          className="btn btn-default btn-sm"
          title={t('Export to .json')}
          target="_blank"
          rel="noopener noreferrer"
        >
          <i className="fa fa-file-code-o" /> .json
        </a>

        <a
          onClick={doExportCSV}
          className={exportToCSVClasses}
          title={t('Export to .csv format')}
          target="_blank"
          rel="noopener noreferrer"
        >
          <i className="fa fa-file-text-o" /> .csv
        </a>

        <DisplayQueryButton
          queryResponse={queryResponse}
          latestQueryFormData={latestQueryFormData}
          chartStatus={chartStatus}
        />
      </div>
    );
  }
  return (
    <DisplayQueryButton latestQueryFormData={latestQueryFormData} />
  );
}

ExploreActionButtons.propTypes = propTypes;
