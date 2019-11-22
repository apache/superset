/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React from 'react';
import PropTypes from 'prop-types';
import SyntaxHighlighter, { registerLanguage } from 'react-syntax-highlighter/light';
import htmlSyntax from 'react-syntax-highlighter/languages/hljs/htmlbars';
import markdownSyntax from 'react-syntax-highlighter/languages/hljs/markdown';
import sqlSyntax from 'react-syntax-highlighter/languages/hljs/sql';
import jsonSyntax from 'react-syntax-highlighter/languages/hljs/json';
import github from 'react-syntax-highlighter/styles/hljs/github';
import { DropdownButton, MenuItem, Row, Col, FormControl } from 'react-bootstrap';
import { Table } from 'reactable-arc';
import { t } from '@superset-ui/translation';
import { SupersetClient } from '@superset-ui/connection';

import getClientErrorObject from '../../utils/getClientErrorObject';
import CopyToClipboard from './../../components/CopyToClipboard';
import { getExploreUrlAndPayload } from '../exploreUtils';

import Loading from '../../components/Loading';
import ModalTrigger from './../../components/ModalTrigger';
import Button from '../../components/Button';
import RowCountLabel from './RowCountLabel';
import { prepareCopyToClipboardTabularData } from '../../utils/common';

registerLanguage('markdown', markdownSyntax);
registerLanguage('html', htmlSyntax);
registerLanguage('sql', sqlSyntax);
registerLanguage('json', jsonSyntax);

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
      filterText: '',
      sqlSupported: datasource && datasource.split('__')[1] === 'table',
    };
    this.beforeOpen = this.beforeOpen.bind(this);
    this.changeFilterText = this.changeFilterText.bind(this);
  }
  beforeOpen(endpointType) {
    this.setState({ isLoading: true });
    const { url, payload } = getExploreUrlAndPayload({
      formData: this.props.latestQueryFormData,
      endpointType,
    });
    SupersetClient.post({
      url,
      postPayload: { form_data: payload },
    })
      .then(({ json }) => {
        this.setState({
          language: json.language,
          query: json.query,
          data: json.data,
          isLoading: false,
          error: null,
        });
      })
      .catch(response =>
        getClientErrorObject(response).then(({ error, statusText }) => {
          this.setState({
            error: error || statusText || t('Sorry, An error occurred'),
            isLoading: false,
          });
        }),
      );
  }
  changeFilterText(event) {
    this.setState({ filterText: event.target.value });
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
      return <Loading />;
    } else if (this.state.error) {
      return <pre>{this.state.error}</pre>;
    } else if (this.state.data) {
      if (this.state.data.length === 0) {
        return 'No data';
      }
      return this.renderDataTable(this.state.data);
    }
    return null;
  }
  renderDataTable(data) {
    return (
      <div style={{ overflow: 'auto' }}>
        <Row>
          <Col md={9}>
            <RowCountLabel rowcount={data.length} suffix={t('rows retrieved')} />
            <CopyToClipboard
              text={prepareCopyToClipboardTabularData(data)}
              wrapped={false}
              copyNode={
                <Button style={{ padding: '2px 10px', fontSize: '11px' }}>
                  <i className="fa fa-clipboard" />
                </Button>
              }
            />
          </Col>
          <Col md={3}>
            <FormControl
              placeholder={t('Search')}
              bsSize="sm"
              value={this.state.filterText}
              onChange={this.changeFilterText}
              style={{ paddingBottom: '5px' }}
            />
          </Col>
        </Row>
        <Table
          className="table table-condensed"
          sortable
          data={data}
          hideFilterInput
          filterBy={this.state.filterText}
          filterable={data.length ? Object.keys(data[0]) : null}
          noDataText={t('No data')}
        />
      </div>
    );
  }
  renderSamplesModalBody() {
    if (this.state.isLoading) {
      return (<img
        className="loading"
        alt="Loading..."
        src="/static/assets/images/loading.gif"
      />);
    } else if (this.state.error) {
      return <pre>{this.state.error}</pre>;
    } else if (this.state.data) {
      return this.renderDataTable(this.state.data);
    }
    return null;
  }
  render() {
    return (
      <DropdownButton
        noCaret
        title={
          <span>
            <i className="fa fa-bars" />&nbsp;
          </span>}
        bsSize="sm"
        pullRight
        id="query"
      >
        <ModalTrigger
          isMenuItem
          animation={this.props.animation}
          triggerNode={<span>{t('View query')}</span>}
          modalTitle={t('View query')}
          bsSize="large"
          beforeOpen={() => this.beforeOpen('query')}
          modalBody={this.renderQueryModalBody()}
          eventKey="1"
        />
        <ModalTrigger
          isMenuItem
          animation={this.props.animation}
          triggerNode={<span>{t('View results')}</span>}
          modalTitle={t('View results')}
          bsSize="large"
          beforeOpen={() => this.beforeOpen('results')}
          modalBody={this.renderResultsModalBody()}
          eventKey="2"
        />
        <ModalTrigger
          isMenuItem
          animation={this.props.animation}
          triggerNode={<span>{t('View samples')}</span>}
          modalTitle={t('View samples')}
          bsSize="large"
          beforeOpen={() => this.beforeOpen('samples')}
          modalBody={this.renderSamplesModalBody()}
          eventKey="2"
        />
        {this.state.sqlSupported && (
          <MenuItem
            eventKey="3"
            onClick={this.redirectSQLLab.bind(this)}
          >
            {t('Run in SQL Lab')}
          </MenuItem>
        )}
      </DropdownButton>
    );
  }
}

DisplayQueryButton.propTypes = propTypes;
DisplayQueryButton.defaultProps = defaultProps;
