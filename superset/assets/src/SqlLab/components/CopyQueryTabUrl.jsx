/* eslint no-alert: 0 */
import React from 'react';
import PropTypes from 'prop-types';
import CopyToClipboard from '../../components/CopyToClipboard';
import { storeQuery } from '../../utils/common';
import { t } from '../../locales';

const propTypes = {
  queryEditor: PropTypes.object.isRequired,
};

export default class CopyQueryTabUrl extends React.PureComponent {
  constructor(props) {
    super(props);
    this.getUrl = this.getUrl.bind(this);
  }

  getUrl(callback) {
    const qe = this.props.queryEditor;
    const sharedQuery = {
      dbId: qe.dbId,
      title: qe.title,
      schema: qe.schema,
      autorun: qe.autorun,
      sql: qe.sql,
    };

    // the fetch call to get a url is async, but execCommand('copy') must be sync
    // get around this with 2 timeouts. calling a timeout from within a timeout is not considered
    // a short-lived, user-initiated sync event
    let url;
    storeQuery(sharedQuery).then((shareUrl) => { url = shareUrl; });
    const longTimeout = setTimeout(() => { if (url) callback(url); }, 750);
    setTimeout(() => {
      if (url) {
        callback(url);
        clearTimeout(longTimeout);
      }
    }, 150);

  }

  render() {
    return (
      <CopyToClipboard
        inMenu
        copyNode={
          <div>
            <i className="fa fa-clipboard" /> <span>{t('share query')}</span>
          </div>
        }
        tooltipText={t('copy URL to clipboard')}
        shouldShowText={false}
        getText={this.getUrl}
      />
    );
  }
}

CopyQueryTabUrl.propTypes = propTypes;
