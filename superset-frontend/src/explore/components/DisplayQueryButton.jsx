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
import React, { useState } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import PropTypes from 'prop-types';
import SyntaxHighlighter from 'react-syntax-highlighter/dist/cjs/light';
import htmlSyntax from 'react-syntax-highlighter/dist/cjs/languages/hljs/htmlbars';
import markdownSyntax from 'react-syntax-highlighter/dist/cjs/languages/hljs/markdown';
import sqlSyntax from 'react-syntax-highlighter/dist/cjs/languages/hljs/sql';
import jsonSyntax from 'react-syntax-highlighter/dist/cjs/languages/hljs/json';
import github from 'react-syntax-highlighter/dist/cjs/styles/hljs/github';
import { DropdownButton } from 'react-bootstrap';
import { styled, t } from '@superset-ui/core';

import { Menu } from 'src/common/components';
import { getClientErrorObject } from '../../utils/getClientErrorObject';
import CopyToClipboard from '../../components/CopyToClipboard';
import { getChartDataRequest } from '../../chart/chartAction';
import downloadAsImage from '../../utils/downloadAsImage';
import Loading from '../../components/Loading';
import ModalTrigger from '../../components/ModalTrigger';
import { sliceUpdated } from '../actions/exploreActions';
import { CopyButton } from './DataTableControl';

SyntaxHighlighter.registerLanguage('markdown', markdownSyntax);
SyntaxHighlighter.registerLanguage('html', htmlSyntax);
SyntaxHighlighter.registerLanguage('sql', sqlSyntax);
SyntaxHighlighter.registerLanguage('json', jsonSyntax);

const propTypes = {
  onOpenPropertiesModal: PropTypes.func,
  onOpenInEditor: PropTypes.func,
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

const CopyButtonViewQuery = styled(CopyButton)`
  && {
    margin: 0 0 ${({ theme }) => theme.gridUnit}px;
  }
`;

export const DisplayQueryButton = props => {
  const { datasource } = props.latestQueryFormData;

  const [language, setLanguage] = useState(null);
  const [query, setQuery] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sqlSupported] = useState(
    datasource && datasource.split('__')[1] === 'table',
  );
  const [menuVisible, setMenuVisible] = useState(false);

  const beforeOpen = resultType => {
    setIsLoading(true);

    getChartDataRequest({
      formData: props.latestQueryFormData,
      resultFormat: 'json',
      resultType,
    })
      .then(response => {
        // Only displaying the first query is currently supported
        const result = response.result[0];
        setLanguage(result.language);
        setQuery(result.query);
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

  const handleMenuClick = ({ key, domEvent }) => {
    const { chartHeight, slice, onOpenInEditor, latestQueryFormData } = props;
    setMenuVisible(false);
    switch (key) {
      case MENU_KEYS.EDIT_PROPERTIES:
        props.onOpenPropertiesModal();
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
              <CopyButtonViewQuery buttonSize="xsmall">
                <i className="fa fa-clipboard" />
              </CopyButtonViewQuery>
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

  const { slice } = props;
  return (
    <DropdownButton
      open={menuVisible}
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
      onToggle={setMenuVisible}
    >
      <Menu onClick={handleMenuClick} selectable={false}>
        {slice && (
          <Menu.Item key={MENU_KEYS.EDIT_PROPERTIES}>
            {t('Edit properties')}
          </Menu.Item>
        )}
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
