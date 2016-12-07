import React from 'react';
import CopyToClipboard from '../../components/CopyToClipboard';
import { getShortUrl } from '../../../utils/common';

const propTypes = {
  queryEditor: React.PropTypes.object.isRequired,
};

export default class CopyQueryTabUrl extends React.PureComponent {
  getUrl(callback) {
    const qe = this.props.queryEditor;
    const params = [];
    if (qe.dbId) params.push('dbid=' + qe.dbId);
    if (qe.title) params.push('title=' + encodeURIComponent(qe.title));
    if (qe.schema) params.push('schema=' + encodeURIComponent(qe.schema));
    if (qe.autorun) params.push('autorun=' + qe.autorun);
    if (qe.sql) params.push('sql=' + encodeURIComponent(qe.sql));

    const queryString = params.join('&');
    const queryLink = window.location.pathname + '?' + queryString;
    getShortUrl(queryLink, callback);
  }

  render() {
    return (
      <CopyToClipboard
        inMenu
        copyNode={(
          <div>
            <i className="fa fa-clipboard" /> <span>share query</span>
          </div>
        )}
        tooltipText="copy URL to clipboard"
        shouldShowText={false}
        getText={this.getUrl.bind(this)}
      />
    );
  }
}

CopyQueryTabUrl.propTypes = propTypes;
