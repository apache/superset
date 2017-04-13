import React, { PropTypes } from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { github } from 'react-syntax-highlighter/dist/styles';

import ModalTrigger from './../../components/ModalTrigger';

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
        });
      },
      error: (data) => {
        this.setState({
          error: data.error,
          isLoading: false,
        });
      },
    });
  }
  beforeOpen() {
    if (this.props.chartStatus === 'loading' || this.props.chartStatus === null) {
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
    }
    return (
      <SyntaxHighlighter language={this.state.language} style={github}>
        {this.state.query}
      </SyntaxHighlighter>);
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
