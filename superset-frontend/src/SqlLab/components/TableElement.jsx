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
import Collapse from 'src/components/Collapse';
import Card from 'src/components/Card';
import ButtonGroup from 'src/components/ButtonGroup';
import { t, styled } from '@superset-ui/core';
import { debounce } from 'lodash';

import { Tooltip } from 'src/components/Tooltip';
import Icons from 'src/components/Icons';
import CopyToClipboard from '../../components/CopyToClipboard';
import { IconTooltip } from '../../components/IconTooltip';
import ColumnElement from './ColumnElement';
import ShowSQL from './ShowSQL';
import ModalTrigger from '../../components/ModalTrigger';
import Loading from '../../components/Loading';

const propTypes = {
  table: PropTypes.object,
  actions: PropTypes.object,
};

const defaultProps = {
  actions: {},
  table: null,
};

const StyledSpan = styled.span`
  color: ${({ theme }) => theme.colors.primary.dark1};
  &: hover {
    color: ${({ theme }) => theme.colors.primary.dark2};
  }
  cursor: pointer;
`;

const Fade = styled.div`
  transition: all ${({ theme }) => theme.transitionTiming}s;
  opacity: ${props => (props.hovered ? 1 : 0)};
`;

const TableElement = props => {
  const [sortColumns, setSortColumns] = useState(false);
  const [hovered, setHovered] = useState(false);

  const { table, actions, isActive } = props;

  const setHover = hovered => {
    debounce(() => setHovered(hovered), 100)();
  };

  const removeTable = () => {
    actions.removeDataPreview(table);
    actions.removeTable(table);
  };

  const toggleSortColumns = () => {
    setSortColumns(prevState => !prevState);
  };

  const renderWell = () => {
    let header;
    if (table.partitions) {
      let partitionQuery;
      let partitionClipBoard;
      if (table.partitions.partitionQuery) {
        ({ partitionQuery } = table.partitions);
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
        <Card size="small">
          <div>
            <small>
              {t('latest partition:')} {latest}
            </small>{' '}
            {partitionClipBoard}
          </div>
        </Card>
      );
    }
    return header;
  };

  const renderControls = () => {
    let keyLink;
    if (table?.indexes?.length) {
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
            `fa fa-sort-${sortColumns ? 'numeric' : 'alpha'}-asc ` +
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
              <IconTooltip
                aria-label="Copy"
                tooltip={t('Copy SELECT statement to the clipboard')}
              >
                <i aria-hidden className="fa fa-clipboard pull-left m-l-2" />
              </IconTooltip>
            }
            text={table.selectStar}
            shouldShowText={false}
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

  const renderHeader = () => (
    <div
      className="clearfix header-container"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Tooltip
        id="copy-to-clipboard-tooltip"
        placement="topLeft"
        style={{ cursor: 'pointer' }}
        title={table.name}
        trigger={['hover']}
      >
        <StyledSpan data-test="collapse" className="table-name">
          <strong>{table.name}</strong>
        </StyledSpan>
      </Tooltip>

      <div className="pull-right header-right-side">
        {table.isMetadataLoading || table.isExtraMetadataLoading ? (
          <Loading position="inline" />
        ) : (
          <Fade
            data-test="fade"
            hovered={hovered}
            onClick={e => e.stopPropagation()}
          >
            {renderControls()}
          </Fade>
        )}
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
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        css={{ paddingTop: 6 }}
      >
        {renderWell()}
        <div>
          {cols?.map(col => (
            <ColumnElement column={col} key={col.name} />
          ))}
        </div>
      </div>
    );
    return metadata;
  };

  const collapseExpandIcon = () => (
    <IconTooltip
      style={{
        position: 'fixed',
        right: '16px',
        left: 'auto',
        fontSize: '12px',
        transform: 'rotate(90deg)',
        display: 'flex',
        alignItems: 'center',
      }}
      aria-label="Collapse"
      tooltip={t(`${isActive ? 'Collapse' : 'Expand'} table preview`)}
    >
      <Icons.RightOutlined
        iconSize="s"
        style={isActive ? { transform: 'rotateY(180deg)' } : null}
      />
    </IconTooltip>
  );

  return (
    <Collapse.Panel
      {...props}
      header={renderHeader()}
      className="TableElement"
      forceRender
      expandIcon={collapseExpandIcon}
    >
      {renderBody()}
    </Collapse.Panel>
  );
};

TableElement.propTypes = propTypes;
TableElement.defaultProps = defaultProps;

export default TableElement;
