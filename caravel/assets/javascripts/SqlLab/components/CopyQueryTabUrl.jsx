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
    if (qe.title) params.push('title=' + qe.title);
    if (qe.schema) params.push('schema=' + qe.schema);
    if (qe.autorun) params.push('autorun=' + qe.autorun);
    if (qe.sql) params.push('sql=' + qe.sql);

    const queryString = params.join('&');
    const queryLink = this.state.cleanUri + '?' + queryString;

    return queryLink;
  }

  render() {
    return (
      <CopyToClipboard
        inMenu
        text={this.getQueryLink()}
        copyNode={<span>copy query</span>}
        shouldShowText={false}
      />
    );
  }
}

CopyQueryTabUrl.propTypes = propTypes;
CopyQueryTabUrl.defaultProps = defaultProps;
