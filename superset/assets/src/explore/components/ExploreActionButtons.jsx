import React from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';
import URLShortLinkButton from '../../components/URLShortLinkButton';
import EmbedCodeButton from './EmbedCodeButton';
import DisplayQueryButton from './DisplayQueryButton';
import { t } from '../../locales';
import { exportChart, getExploreLongUrl } from '../exploreUtils';

const propTypes = {
  actions: PropTypes.object.isRequired,
  canDownload: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]).isRequired,
  chartStatus: PropTypes.string,
  latestQueryFormData: PropTypes.object,
  queryResponse: PropTypes.object,
};

export default function ExploreActionButtons({
    actions, canDownload, chartStatus, latestQueryFormData, queryResponse }) {
  const exportToCSVClasses = cx('btn btn-default btn-sm', {
    'disabled disabledButton': !canDownload,
  });
  const doExportCSV = exportChart.bind(this, latestQueryFormData, 'csv');
  const doExportChart = exportChart.bind(this, latestQueryFormData, 'json');

  return (
    <div className="btn-group results" role="group">
      {latestQueryFormData &&
        <URLShortLinkButton
          url={getExploreLongUrl(latestQueryFormData)}
          emailSubject="Superset Chart"
          emailContent="Check out this chart: "
        />
      }

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
        onOpenInEditor={actions.redirectSQLLab}
      />
    </div>
  );
}

ExploreActionButtons.propTypes = propTypes;
