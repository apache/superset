import React, { PropTypes } from 'react';
import cx from 'classnames';
import URLShortLinkButton from './URLShortLinkButton';
import EmbedCodeButton from './EmbedCodeButton';
import DisplayQueryButton from './DisplayQueryButton';
import { getExploreUrl } from '../exploreUtils';

const propTypes = {
  canDownload: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]).isRequired,
  formData: PropTypes.object,
};

export default function ExploreActionButtons({ canDownload, formData }) {
  const exportToCSVClasses = cx('btn btn-default btn-sm', {
    'disabled disabledButton': !canDownload,
  });
  return (
    <div className="btn-group results" role="group">
      <URLShortLinkButton />

      <EmbedCodeButton standaloneEndpoint={getExploreUrl(formData, 'standalone')} />

      <a
        href={getExploreUrl(formData, 'json')}
        className="btn btn-default btn-sm"
        title="Export to .json"
        target="_blank"
      >
        <i className="fa fa-file-code-o"></i> .json
      </a>

      <a
        href={getExploreUrl(formData, 'csv')}
        className={exportToCSVClasses}
        title="Export to .csv format"
        target="_blank"
      >
        <i className="fa fa-file-text-o"></i> .csv
      </a>

      <DisplayQueryButton
        queryEndpoint={getExploreUrl(formData, 'query')}
      />
    </div>
  );
}

ExploreActionButtons.propTypes = propTypes;
