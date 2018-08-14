import React from 'react';
import PropTypes from 'prop-types';
import SyntaxHighlighter, { registerLanguage } from 'react-syntax-highlighter/light';
import html from 'react-syntax-highlighter/languages/hljs/htmlbars';
import markdown from 'react-syntax-highlighter/languages/hljs/markdown';
import sql from 'react-syntax-highlighter/languages/hljs/sql';
import json from 'react-syntax-highlighter/languages/hljs/json';
import github from 'react-syntax-highlighter/styles/hljs/github';
import { DropdownButton, MenuItem } from 'react-bootstrap';
import { BootstrapTable, TableHeaderColumn } from 'react-bootstrap-table';
import 'react-bootstrap-table/css/react-bootstrap-table.css';

import CopyToClipboard from './../../components/CopyToClipboard';
import { getExploreUrlAndPayload } from '../exploreUtils';

import Loading from '../../components/Loading';
import ModalTrigger from './../../components/ModalTrigger';
import Button from '../../components/Button';
import { t } from '../../locales';

registerLanguage('markdown', markdown);
registerLanguage('html', html);
registerLanguage('sql', sql);
registerLanguage('json', json);

const $ = (window.$ = require('jquery'));

const propTypes = {
  onOpenInEditor: PropTypes.func,
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
    const { datasource } = props.latestQueryFormData;
    this.state = {
      language: null,
      query: null,
      data: null,
      isLoading: false,
      error: null,
      sqlSupported: datasource && datasource.split('__')[1] === 'table',
    };
    this.beforeOpen = this.beforeOpen.bind(this);
  }
  beforeOpen() {
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
          data: data.data,
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
  redirectSQLLab() {
    this.props.onOpenInEditor(this.props.latestQueryFormData);
  }
  renderQueryModalBody() {
    if (this.state.isLoading) {
      return <Loading />;
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
  renderResultsModalBody() {
    if (this.state.isLoading) {
      return (<img
        className="loading"
        alt="Loading..."
        src="/static/assets/images/loading.gif"
      />);
    } else if (this.state.error) {
      return <pre>{this.state.error}</pre>;
    } else if (this.state.data) {
      if (this.state.data.length === 0) {
        return 'No data';
      }
      const headers = Object.keys(this.state.data[0]).map((k, i) => (
        <TableHeaderColumn key={k} dataField={k} isKey={i === 0} dataSort>{k}</TableHeaderColumn>
      ));
      return (
        <BootstrapTable
          height="auto"
          data={this.state.data}
          striped
          hover
          condensed
        >
          {headers}
        </BootstrapTable>
      );
    }
    return null;
  }
  render() {
    return (
      <DropdownButton title={t('Query')} bsSize="sm" pullRight id="query">
        <ModalTrigger
          isMenuItem
          animation={this.props.animation}
          triggerNode={<span>{t('View query')}</span>}
          modalTitle={t('View query')}
          bsSize="large"
          beforeOpen={this.beforeOpen}
          modalBody={this.renderQueryModalBody()}
          eventKey="1"
        />
        <ModalTrigger
          isMenuItem
          animation={this.props.animation}
          triggerNode={<span>{t('View results')}</span>}
          modalTitle={t('View results')}
          bsSize="large"
          beforeOpen={this.beforeOpen}
          modalBody={this.renderResultsModalBody()}
          eventKey="2"
        />
        {this.state.sqlSupported && <MenuItem
          eventKey="3"
          onClick={this.redirectSQLLab.bind(this)}
        >
          {t('Run in SQL Lab')}
        </MenuItem>}
      </DropdownButton>
    );
  }
}

DisplayQueryButton.propTypes = propTypes;
DisplayQueryButton.defaultProps = defaultProps;
