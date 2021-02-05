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
import PropTypes from 'prop-types';
import { Collapse, Well } from 'react-bootstrap';
import ButtonGroup from 'src/components/ButtonGroup';
import { t, styled } from '@superset-ui/core';

import Fade from 'src/common/components/Fade';
import { Tooltip } from 'src/common/components/Tooltip';
import CopyToClipboard from '../../components/CopyToClipboard';
import { IconTooltip } from '../../components/IconTooltip';
import ColumnElement from './ColumnElement';
import ShowSQL from './ShowSQL';
import ModalTrigger from '../../components/ModalTrigger';
import Loading from '../../components/Loading';

const propTypes = {
  table: PropTypes.object,
  actions: PropTypes.object,
  timeout: PropTypes.number, // used for tests
};

const defaultProps = {
  actions: {},
  table: null,
  timeout: 500,
};

const StyledSpan = styled.span`
  color: ${({ theme }) => theme.colors.primary.dark1};
  &: hover {
    color: ${({ theme }) => theme.colors.primary.dark2};
  }
  cursor: pointer;
`;

function TableElement({ actions, table, timeout }) {
  const [sortColumns, setSortColumns] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [hovered, setHovered] = useState(false);

  const setHover = hovered => {
    setHovered(hovered);
  };

  const toggleTable = e => {
    e.preventDefault();
    if (table.expanded) {
      actions.collapseTable(table);
    } else {
      actions.expandTable(table);
    }
  };

  const removeTable = () => {
    setExpanded(false);
    actions.removeDataPreview(table);
  };

  const toggleSortColumns = () => {
    setSortColumns(!sortColumns);
  };

  const removeFromStore = () => {
    actions.removeTable(table);
  };

  const renderWell = () => {
    let header;
    if (table.partitions) {
      let partitionQuery;
      let partitionClipBoard;
      if (table.partitions.partitionQuery) {
        ({ partitionQuery } = table.partitions.partitionQuery);
        const tt = t('Copy partition query to clipboard');
        partitionClipBoard = (
          <CopyToClipboard
            text={partitionQuery}
            shouldShowText={false}
            tooltipText={tt}
            copyNode={<i className="fa fa-clipboard" />}
          />
        );
      }
      let latest = Object.entries(table.partitions?.latest || []).map(
        ([key, value]) => `${key}=${value}`,
      );
      latest = latest.join('/');
      header = (
        <Well bsSize="small">
          <div>
            <small>
              {t('latest partition:')} {latest}
            </small>{' '}
            {partitionClipBoard}
          </div>
        </Well>
      );
    }
    return header;
  };

  const renderControls = () => {
    let keyLink;
    if (table.indexes && table.indexes.length > 0) {
      keyLink = (
        <ModalTrigger
          modalTitle={
            <div>
              {t('Keys for table')} <strong>{table.name}</strong>
            </div>
          }
          modalBody={table.indexes.map((ix, i) => (
            <pre key={i}>{JSON.stringify(ix, null, '  ')}</pre>
          ))}
          triggerNode={
            <IconTooltip
              className="fa fa-key pull-left m-l-2"
              tooltip={t('View keys & indexes (%s)', table.indexes.length)}
            />
          }
        />
      );
    }
    return (
      <ButtonGroup className="ws-el-controls">
        {keyLink}
        <IconTooltip
          className={
            `fa fa-sort-${!sortColumns ? 'alpha' : 'numeric'}-asc ` +
            'pull-left sort-cols m-l-2 pointer'
          }
          onClick={toggleSortColumns}
          tooltip={
            !sortColumns
              ? t('Sort columns alphabetically')
              : t('Original table column order')
          }
        />
        {table.selectStar && (
          <CopyToClipboard
            copyNode={
              <IconTooltip aria-label="Copy">
                <i aria-hidden className="fa fa-clipboard pull-left m-l-2" />
              </IconTooltip>
            }
            text={table.selectStar}
            shouldShowText={false}
            tooltipText={t('Copy SELECT statement to the clipboard')}
          />
        )}
        {table.view && (
          <ShowSQL
            sql={table.view}
            tooltipText={t('Show CREATE VIEW statement')}
            title={t('CREATE VIEW statement')}
          />
        )}
        <IconTooltip
          className="fa fa-times table-remove pull-left m-l-2 pointer"
          onClick={removeTable}
          tooltip={t('Remove table preview')}
        />
      </ButtonGroup>
    );
  };

  const header = (
    <div className="clearfix header-container">
      <Tooltip
        id="copy-to-clipboard-tooltip"
        placement="top"
        style={{ cursor: 'pointer' }}
        title={table.name}
        trigger={['hover']}
      >
        <StyledSpan
          data-test="collapse"
          className="table-name"
          onClick={e => {
            toggleTable(e);
          }}
        >
          <strong>{table.name}</strong>
        </StyledSpan>
      </Tooltip>

      <div className="pull-right header-right-side">
        {table.isMetadataLoading || table.isExtraMetadataLoading ? (
          <Loading position="inline" />
        ) : (
          <Fade hovered={hovered}>{renderControls()}</Fade>
        )}
        <i
          role="button"
          aria-label="Toggle table"
          tabIndex={0}
          onClick={e => {
            toggleTable(e);
          }}
          className={
            'text-primary pointer m-l-10 ' +
            'fa fa-lg ' +
            `fa-angle-${table.expanded ? 'up' : 'down'}`
          }
        />
      </div>
    </div>
  );

  const renderBody = () => {
    let cols;
    if (table.columns) {
      cols = table.columns.slice();
      if (sortColumns) {
        cols.sort((a, b) => {
          const colA = a.name.toUpperCase();
          const colB = b.name.toUpperCase();
          if (colA < colB) {
            return -1;
          }
          if (colA > colB) {
            return 1;
          }
          return 0;
        });
      }
    }
    const metadata = (
      <Collapse in={table.expanded} timeout={timeout}>
        <div>
          {renderWell()}
          <div className="table-columns m-t-5">
            {cols &&
              cols.map(col => <ColumnElement column={col} key={col.name} />)}
          </div>
        </div>
      </Collapse>
    );
    return metadata;
  };

  return (
    <Collapse in={expanded} timeout={timeout} onExited={removeFromStore}>
      <div
        className="TableElement table-schema m-b-10"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {header}
        <div>{renderBody()}</div>
      </div>
    </Collapse>
  );
}
TableElement.propTypes = propTypes;
TableElement.defaultProps = defaultProps;

export default TableElement;
