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
import React, { useState, useMemo } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import PropTypes from 'prop-types';
import SyntaxHighlighter from 'react-syntax-highlighter/dist/cjs/light';
import htmlSyntax from 'react-syntax-highlighter/dist/cjs/languages/hljs/htmlbars';
import markdownSyntax from 'react-syntax-highlighter/dist/cjs/languages/hljs/markdown';
import sqlSyntax from 'react-syntax-highlighter/dist/cjs/languages/hljs/sql';
import jsonSyntax from 'react-syntax-highlighter/dist/cjs/languages/hljs/json';
import github from 'react-syntax-highlighter/dist/cjs/styles/hljs/github';
import { DropdownButton, Row, Col, FormControl } from 'react-bootstrap';
import { styled, t } from '@superset-ui/core';

import { Menu } from 'src/common/components';
import TableView, { EmptyWrapperType } from 'src/components/TableView';
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

SyntaxHighlighter.registerLanguage('markdown', markdownSyntax);
SyntaxHighlighter.registerLanguage('html', htmlSyntax);
SyntaxHighlighter.registerLanguage('sql', sqlSyntax);
SyntaxHighlighter.registerLanguage('json', jsonSyntax);

const propTypes = {
  onOpenInEditor: PropTypes.func,
  queryResponse: PropTypes.object,
  chartStatus: PropTypes.string,
  chartHeight: PropTypes.string.isRequired,
  latestQueryFormData: PropTypes.object.isRequired,
  slice: PropTypes.object,
};

const MENU_KEYS = {
  EDIT_PROPERTIES: 'edit_properties',
  RUN_IN_SQL_LAB: 'run_in_sql_lab',
  DOWNLOAD_AS_IMAGE: 'download_as_image',
};

const CopyButton = styled(Button)`
  padding: ${({ theme }) => theme.gridUnit / 2}px
    ${({ theme }) => theme.gridUnit * 2.5}px;
  font-size: ${({ theme }) => theme.typography.sizes.s}px;

  // needed to override button's first-of-type margin: 0
  && {
    margin-left: ${({ theme }) => theme.gridUnit * 2}px;
  }
`;

export const DisplayQueryButton = props => {
  const { datasource } = props.latestQueryFormData;

  const [language, setLanguage] = useState(null);
  const [query, setQuery] = useState(null);
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterText, setFilterText] = useState('');
  const [sqlSupported] = useState(
    datasource && datasource.split('__')[1] === 'table',
  );
  const [isPropertiesModalOpen, setIsPropertiesModalOpen] = useState(false);

  const tableData = useMemo(() => {
    if (!data?.length) {
      return [];
    }
    const formattedData = applyFormattingToTabularData(data);
    return formattedData.filter(row =>
      Object.values(row).some(value =>
        value.toString().toLowerCase().includes(filterText.toLowerCase()),
      ),
    );
  }, [data, filterText]);

  const columns = useMemo(
    () =>
      data?.length
        ? Object.keys(data[0]).map(key => ({ accessor: key, Header: key }))
        : [],
    [data],
  );

  const beforeOpen = resultType => {
    setIsLoading(true);

    getChartDataRequest({
      formData: props.latestQueryFormData,
      resultFormat: 'json',
      resultType,
    })
      .then(response => {
        // Currently displaying of only first query is supported
        const result = response.result[0];
        setLanguage(result.language);
        setQuery(result.query);
        setData(result.data);
        setIsLoading(false);
        setError(null);
      })
      .catch(response => {
        getClientErrorObject(response).then(({ error, statusText }) => {
          setError(error || statusText || t('Sorry, An error occurred'));
          setIsLoading(false);
        });
      });
  };

  const changeFilterText = event => {
    setFilterText(event.target.value);
  };

  const openPropertiesModal = () => {
    setIsPropertiesModalOpen(true);
  };

  const closePropertiesModal = () => {
    setIsPropertiesModalOpen(false);
  };

  const handleMenuClick = ({ key, domEvent }) => {
    const { chartHeight, slice, onOpenInEditor, latestQueryFormData } = props;
    switch (key) {
      case MENU_KEYS.EDIT_PROPERTIES:
        openPropertiesModal();
        break;
      case MENU_KEYS.RUN_IN_SQL_LAB:
        onOpenInEditor(latestQueryFormData);
        break;
      case MENU_KEYS.DOWNLOAD_AS_IMAGE:
        downloadAsImage(
          '.chart-container',
          // eslint-disable-next-line camelcase
          slice?.slice_name ?? t('New chart'),
          {
            height: parseInt(chartHeight, 10),
          },
        )(domEvent);
        break;
      default:
        break;
    }
  };

  const renderQueryModalBody = () => {
    if (isLoading) {
      return <Loading />;
    }
    if (error) {
      return <pre>{error}</pre>;
    }
    if (query) {
      return (
        <div>
          <CopyToClipboard
            text={query}
            shouldShowText={false}
            copyNode={
              <Button style={{ position: 'absolute', right: 20 }}>
                <i className="fa fa-clipboard" />
              </Button>
            }
          />
          <SyntaxHighlighter language={language} style={github}>
            {query}
          </SyntaxHighlighter>
        </div>
      );
    }
    return null;
  };

  const renderDataTable = () => {
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
                <CopyButton>
                  <i className="fa fa-clipboard" />
                </CopyButton>
              }
            />
          </Col>
          <Col md={3}>
            <FormControl
              placeholder={t('Search')}
              bsSize="sm"
              value={filterText}
              onChange={changeFilterText}
              style={{ paddingBottom: '5px' }}
            />
          </Col>
        </Row>
        <TableView
          columns={columns}
          data={tableData}
          withPagination={false}
          noDataText={t('No data')}
          emptyWrapperType={EmptyWrapperType.Small}
          className="table-condensed"
        />
      </div>
    );
  };

  const renderResultsModalBody = () => {
    if (isLoading) {
      return <Loading />;
    }
    if (error) {
      return <pre>{error}</pre>;
    }
    if (data) {
      if (data.length === 0) {
        return 'No data';
      }
      return renderDataTable();
    }
    return null;
  };

  const renderSamplesModalBody = () => {
    if (isLoading) {
      return <Loading />;
    }
    if (error) {
      return <pre>{error}</pre>;
    }
    if (data) {
      return renderDataTable();
    }
    return null;
  };

  const { slice } = props;
  return (
    <DropdownButton
      noCaret
      data-test="query-dropdown"
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
      <Menu onClick={handleMenuClick} selectable={false}>
        {slice && [
          <Menu.Item key={MENU_KEYS.EDIT_PROPERTIES}>
            {t('Edit properties')}
          </Menu.Item>,
          <PropertiesModal
            slice={slice}
            show={isPropertiesModalOpen}
            onHide={closePropertiesModal}
            onSave={props.sliceUpdated}
          />,
        ]}
        <Menu.Item>
          <ModalTrigger
            triggerNode={
              <span data-test="view-query-menu-item">{t('View query')}</span>
            }
            modalTitle={t('View query')}
            beforeOpen={() => beforeOpen('query')}
            modalBody={renderQueryModalBody()}
            responsive
          />
        </Menu.Item>
        <Menu.Item>
          <ModalTrigger
            triggerNode={<span>{t('View results')}</span>}
            modalTitle={t('View results')}
            beforeOpen={() => beforeOpen('results')}
            modalBody={renderResultsModalBody()}
            responsive
          />
        </Menu.Item>
        <Menu.Item>
          <ModalTrigger
            triggerNode={<span>{t('View samples')}</span>}
            modalTitle={t('View samples')}
            beforeOpen={() => beforeOpen('samples')}
            modalBody={renderSamplesModalBody()}
            responsive
          />
        </Menu.Item>
        {sqlSupported && (
          <Menu.Item key={MENU_KEYS.RUN_IN_SQL_LAB}>
            {t('Run in SQL Lab')}
          </Menu.Item>
        )}
        <Menu.Item key={MENU_KEYS.DOWNLOAD_AS_IMAGE}>
          {t('Download as image')}
        </Menu.Item>
      </Menu>
    </DropdownButton>
  );
};

DisplayQueryButton.propTypes = propTypes;

function mapDispatchToProps(dispatch) {
  return bindActionCreators({ sliceUpdated }, dispatch);
}

export default connect(null, mapDispatchToProps)(DisplayQueryButton);
