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
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import PropTypes from 'prop-types';
import SyntaxHighlighter, {
  registerLanguage,
} from 'react-syntax-highlighter/light';
import htmlSyntax from 'react-syntax-highlighter/languages/hljs/htmlbars';
import markdownSyntax from 'react-syntax-highlighter/languages/hljs/markdown';
import sqlSyntax from 'react-syntax-highlighter/languages/hljs/sql';
import jsonSyntax from 'react-syntax-highlighter/languages/hljs/json';
import github from 'react-syntax-highlighter/styles/hljs/github';
import {
  DropdownButton,
  MenuItem,
  Row,
  Col,
  FormControl,
} from 'react-bootstrap';
import { Table } from 'reactable-arc';
import { t } from '@superset-ui/core';

import Button from 'src/components/Button';
import getClientErrorObject from '../../utils/getClientErrorObject';
import CopyToClipboard from '../../components/CopyToClipboard';
import { getChartDataRequest } from '../../chart/chartAction';
import downloadAsImage from '../../utils/downloadAsImage';
import Loading from '../../components/Loading';
import ModalTrigger from '../../components/ModalTrigger';
import RowCountLabel from './RowCountLabel';
import {
  applyFormattingToTabularData,
  prepareCopyToClipboardTabularData,
} from '../../utils/common';
import PropertiesModal from './PropertiesModal';
import { sliceUpdated } from '../actions/exploreActions';

registerLanguage('markdown', markdownSyntax);
registerLanguage('html', htmlSyntax);
registerLanguage('sql', sqlSyntax);
registerLanguage('json', jsonSyntax);

const propTypes = {
  onOpenInEditor: PropTypes.func,
  animation: PropTypes.bool,
  queryResponse: PropTypes.object,
  chartStatus: PropTypes.string,
  chartHeight: PropTypes.string.isRequired,
  latestQueryFormData: PropTypes.object.isRequired,
  slice: PropTypes.object,
};
const defaultProps = {
  animation: true,
};

export class DisplayQueryButton extends React.PureComponent {
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
      isPropertiesModalOpen: false,
    };
    this.beforeOpen = this.beforeOpen.bind(this);
    this.changeFilterText = this.changeFilterText.bind(this);
    this.openPropertiesModal = this.openPropertiesModal.bind(this);
    this.closePropertiesModal = this.closePropertiesModal.bind(this);
  }

  beforeOpen(resultType) {
    this.setState({ isLoading: true });

    getChartDataRequest({
      formData: this.props.latestQueryFormData,
      resultFormat: 'json',
      resultType,
    })
      .then(response => {
        // Currently displaying of only first query is supported
        const result = response.result[0];
        this.setState({
          language: result.language,
          query: result.query,
          data: result.data,
          isLoading: false,
          error: null,
        });
      })
      .catch(response => {
        getClientErrorObject(response).then(({ error, statusText }) => {
          this.setState({
            error: error || statusText || t('Sorry, An error occurred'),
            isLoading: false,
          });
        });
      });
  }

  changeFilterText(event) {
    this.setState({ filterText: event.target.value });
  }

  redirectSQLLab() {
    this.props.onOpenInEditor(this.props.latestQueryFormData);
  }

  openPropertiesModal() {
    this.setState({ isPropertiesModalOpen: true });
  }

  closePropertiesModal() {
    this.setState({ isPropertiesModalOpen: false });
  }

  renderQueryModalBody() {
    if (this.state.isLoading) {
      return <Loading />;
    }
    if (this.state.error) {
      return <pre>{this.state.error}</pre>;
    }
    if (this.state.query) {
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
    }
    if (this.state.error) {
      return <pre>{this.state.error}</pre>;
    }
    if (this.state.data) {
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
            <RowCountLabel
              rowcount={data.length}
              suffix={t('rows retrieved')}
            />
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
          data={applyFormattingToTabularData(data)}
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
      return <Loading />;
    }
    if (this.state.error) {
      return <pre>{this.state.error}</pre>;
    }
    if (this.state.data) {
      return this.renderDataTable(this.state.data);
    }
    return null;
  }

  render() {
    const { animation, chartHeight, slice } = this.props;
    return (
      <DropdownButton
        noCaret
        title={
          <span>
            <i className="fa fa-bars" />
            &nbsp;
          </span>
        }
        bsSize="sm"
        pullRight
        id="query"
      >
        {slice && (
          <>
            <MenuItem onClick={this.openPropertiesModal}>
              {t('Edit properties')}
            </MenuItem>
            <PropertiesModal
              slice={slice}
              show={this.state.isPropertiesModalOpen}
              onHide={this.closePropertiesModal}
              onSave={this.props.sliceUpdated}
              animation={animation}
            />
          </>
        )}
        <ModalTrigger
          isMenuItem
          animation={animation}
          triggerNode={<span>{t('View query')}</span>}
          modalTitle={t('View query')}
          bsSize="large"
          beforeOpen={() => this.beforeOpen('query')}
          modalBody={this.renderQueryModalBody()}
        />
        <ModalTrigger
          isMenuItem
          animation={animation}
          triggerNode={<span>{t('View results')}</span>}
          modalTitle={t('View results')}
          bsSize="large"
          beforeOpen={() => this.beforeOpen('results')}
          modalBody={this.renderResultsModalBody()}
        />
        <ModalTrigger
          isMenuItem
          animation={animation}
          triggerNode={<span>{t('View samples')}</span>}
          modalTitle={t('View samples')}
          bsSize="large"
          beforeOpen={() => this.beforeOpen('samples')}
          modalBody={this.renderSamplesModalBody()}
        />
        {this.state.sqlSupported && (
          <MenuItem eventKey="3" onClick={this.redirectSQLLab.bind(this)}>
            {t('Run in SQL Lab')}
          </MenuItem>
        )}
        <MenuItem
          onClick={downloadAsImage(
            '.chart-container',
            // eslint-disable-next-line camelcase
            slice?.slice_name ?? t('New chart'),
            {
              height: parseInt(chartHeight, 10),
            },
          )}
        >
          {t('Download as image')}
        </MenuItem>
      </DropdownButton>
    );
  }
}

DisplayQueryButton.propTypes = propTypes;
DisplayQueryButton.defaultProps = defaultProps;

function mapDispatchToProps(dispatch) {
  return bindActionCreators({ sliceUpdated }, dispatch);
}

export default connect(null, mapDispatchToProps)(DisplayQueryButton);
