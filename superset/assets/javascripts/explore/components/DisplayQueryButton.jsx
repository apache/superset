import React from 'react';
import PropTypes from 'prop-types';
import SyntaxHighlighter, { registerLanguage } from 'react-syntax-highlighter/dist/light';
import html from 'react-syntax-highlighter/dist/languages/htmlbars';
import markdown from 'react-syntax-highlighter/dist/languages/markdown';
import sql from 'react-syntax-highlighter/dist/languages/sql';
import json from 'react-syntax-highlighter/dist/languages/json';
import github from 'react-syntax-highlighter/dist/styles/github';
import CopyToClipboard from './../../components/CopyToClipboard';
import { getExploreUrlAndPayload } from '../exploreUtils';

import ModalTrigger from './../../components/ModalTrigger';
import Button from '../../components/Button';
import { t } from '../../locales';

registerLanguage('markdown', markdown);
registerLanguage('html', html);
registerLanguage('sql', sql);
registerLanguage('json', json);

const $ = window.$ = require('jquery');

const propTypes = {
  animation: PropTypes.bool,
  queryResponse: PropTypes.object,
  chartStatus: PropTypes.string,
  latestQueryFormData: PropTypes.object.isRequired,
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
    const { url, payload } = getExploreUrlAndPayload({
      formData: this.props.latestQueryFormData,
      endpointType: 'query',
    });
    $.ajax({
      type: 'POST',
      url,
      data: {
        form_data: JSON.stringify(payload),
      },
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
          error: data.responseJSON ? data.responseJSON.error : t('Error...'),
          isLoading: false,
        });
      },
    });
  }
  beforeOpen() {
    if (
      ['loading', null].indexOf(this.props.chartStatus) >= 0
      || !this.props.queryResponse || !this.props.queryResponse.query
    ) {
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
        <div>
          <CopyToClipboard
            text={this.state.query}
            shouldShowText={false}
            copyNode={
              <Button style={{ position: 'absolute', right: 20 }}>
                <i className="fa fa-clipboard" />
              </Button>
            }
          />
          <SyntaxHighlighter language={this.state.language} style={github}>
            {this.state.query}
          </SyntaxHighlighter>
        </div>
      );
    }
    return null;
  }
  render() {
    return (
      <ModalTrigger
        animation={this.props.animation}
        isButton
        triggerNode={<span>View Query</span>}
        modalTitle={t('Query')}
        bsSize="large"
        beforeOpen={this.beforeOpen}
        modalBody={this.renderModalBody()}
      />
    );
  }
}

DisplayQueryButton.propTypes = propTypes;
DisplayQueryButton.defaultProps = defaultProps;
