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
  chartStatus: PropTypes.string,
  latestQueryFormData: PropTypes.object,
  queryResponse: PropTypes.object,
};

export default function ExploreActionButtons({
    canDownload, chartStatus, latestQueryFormData, queryResponse }) {
  const exportToCSVClasses = cx('btn btn-default btn-sm', {
    'disabled disabledButton': !canDownload,
  });
  const doExportCSV = exportChart.bind(this, latestQueryFormData, 'csv');
  const doExportChart = exportChart.bind(this, latestQueryFormData, 'json');

  return (
    <div className="btn-group results" role="group">
      {latestQueryFormData &&
        <URLShortLinkButton latestQueryFormData={latestQueryFormData} />}

      {latestQueryFormData &&
        <EmbedCodeButton latestQueryFormData={latestQueryFormData} />}

      {latestQueryFormData &&
        <a
          onClick={doExportChart}
          className="btn btn-default btn-sm"
          title={t('Export to .json')}
          target="_blank"
          rel="noopener noreferrer"
        >
          <i className="fa fa-file-code-o" /> .json
        </a>}
      {latestQueryFormData &&
        <a
          onClick={doExportCSV}
          className={exportToCSVClasses}
          title={t('Export to .csv format')}
          target="_blank"
          rel="noopener noreferrer"
        >
          <i className="fa fa-file-text-o" /> .csv
        </a>}
      <DisplayQueryButton
        queryResponse={queryResponse}
        latestQueryFormData={latestQueryFormData}
        chartStatus={chartStatus}
      />
    </div>
  );
}

ExploreActionButtons.propTypes = propTypes;
