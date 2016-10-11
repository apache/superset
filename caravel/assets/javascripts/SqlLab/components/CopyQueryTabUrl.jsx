import React from 'react';
import CopyToClipboard from '../../components/CopyToClipboard';

const propTypes = {
  qe: React.PropTypes.object,
};

const defaultProps = {
  qe: null,
};

export default class CopyQueryTabUrl extends React.Component {
  constructor(props) {
    super(props);
    const uri = window.location.toString();
    const search = window.location.search;
    const cleanUri = search ? uri.substring(0, uri.indexOf('?')) : uri;
    const query = search.substring(1);
    this.state = {
      uri,
      cleanUri,
      query,
    };
  }

  getQueryLink() {
    const params = [];
    const qe = this.props.qe;
    if (qe.dbId) params.push('dbid=' + qe.dbId);
    if (qe.title) params.push('title=' + encodeURIComponent(qe.title));
    if (qe.schema) params.push('schema=' + encodeURIComponent(qe.schema));
    if (qe.autorun) params.push('autorun=' + qe.autorun);
    if (qe.sql) params.push('sql=' + encodeURIComponent(qe.sql));

    const queryString = params.join('&');
    const queryLink = this.state.cleanUri + '?' + queryString;

    return queryLink;
  }

  render() {
    return (
      <CopyToClipboard
        inMenu
        text={this.getQueryLink()}
        copyNode={<span>share query</span>}
        tooltipText="copy URL to clipboard"
        shouldShowText={false}
      />
    );
  }
}

CopyQueryTabUrl.propTypes = propTypes;
CopyQueryTabUrl.defaultProps = defaultProps;
