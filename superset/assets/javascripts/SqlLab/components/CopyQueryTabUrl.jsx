import React from 'react';
import CopyToClipboard from '../../components/CopyToClipboard';
import { storeQuery } from '../../../utils/common';

const propTypes = {
  queryEditor: React.PropTypes.object.isRequired,
};

export default class CopyQueryTabUrl extends React.PureComponent {
  getUrl(callback) {
    const qe = this.props.queryEditor;
    const sharedQuery = {
      dbId: qe.dbId,
      title: qe.title,
      schema: qe.schema,
      autorun: qe.autorun,
      sql: qe.sql,
    };
    storeQuery(sharedQuery, callback);
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
