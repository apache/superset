import React from 'react';
import PropTypes from 'prop-types';
import SyntaxHighlighter, { registerLanguage } from 'react-syntax-highlighter/dist/light';
import html from 'react-syntax-highlighter/dist/languages/htmlbars';
import markdown from 'react-syntax-highlighter/dist/languages/markdown';
import github from 'react-syntax-highlighter/dist/styles/github';

import ModalTrigger from './../../components/ModalTrigger';

registerLanguage('markdown', markdown);
registerLanguage('html', html);

const $ = window.$ = require('jquery');

const propTypes = {
  animation: PropTypes.bool,
  queryResponse: PropTypes.object,
  chartStatus: PropTypes.string,
  queryEndpoint: PropTypes.string.isRequired,
};
const defaultProps = {
  animation: true,
};

export default class DisplayQueryButton extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      language: null,
      query: null,
      isLoading: false,
      error: null,
    };
    this.beforeOpen = this.beforeOpen.bind(this);
    this.fetchQuery = this.fetchQuery.bind(this);
  }
  setStateFromQueryResponse() {
    const qr = this.props.queryResponse;
    this.setState({
      language: qr.language,
      query: qr.query,
      isLoading: false,
    });
  }
  fetchQuery() {
    this.setState({ isLoading: true });
    $.ajax({
      type: 'GET',
      url: this.props.queryEndpoint,
      success: (data) => {
        this.setState({
          language: data.language,
          query: data.query,
          isLoading: false,
          error: null,
        });
      },
      error: (data) => {
        this.setState({
          error: data.responseJSON ? data.responseJSON.error : 'Error...',
          isLoading: false,
        });
      },
    });
  }
  beforeOpen() {
    if (['loading', null].indexOf(this.props.chartStatus) >= 0 || !this.props.queryResponse) {
      this.fetchQuery();
    } else {
      this.setStateFromQueryResponse();
    }
  }
  renderModalBody() {
    if (this.state.isLoading) {
      return (<img
        className="loading"
        alt="Loading..."
        src="/static/assets/images/loading.gif"
      />);
    } else if (this.state.error) {
      return <pre>{this.state.error}</pre>;
    } else if (this.state.query) {
      return (
        <SyntaxHighlighter language={this.state.language} style={github}>
          {this.state.query}
        </SyntaxHighlighter>);
    }
    return null;
  }
  render() {
    return (
      <ModalTrigger
        animation={this.props.animation}
        isButton
        triggerNode={<span>Query</span>}
        modalTitle="Query"
        bsSize="large"
        beforeOpen={this.beforeOpen}
        modalBody={this.renderModalBody()}
      />
    );
  }
}

DisplayQueryButton.propTypes = propTypes;
DisplayQueryButton.defaultProps = defaultProps;
