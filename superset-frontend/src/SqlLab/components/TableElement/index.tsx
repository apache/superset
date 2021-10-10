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
import Collapse from 'src/components/Collapse';
import Card from 'src/components/Card';
import ButtonGroup from 'src/components/ButtonGroup';
import { t, styled } from '@superset-ui/core';
import { debounce } from 'lodash';

import { Tooltip } from 'src/components/Tooltip';
import CopyToClipboard from 'src/components/CopyToClipboard';
import { IconTooltip } from 'src/components/IconTooltip';
import ModalTrigger from 'src/components/ModalTrigger';
import Loading from 'src/components/Loading';
import ColumnElement, { ColumnKeyTypeType } from '../ColumnElement';
import ShowSQL from '../ShowSQL';

interface Column {
  name: string;
  keys?: { type: ColumnKeyTypeType }[];
  type: string;
}

interface Table {
  id: string;
  name: string;
  partitions?: {
    partitionQuery: string;
    latest: object[];
  };
  metadata?: Record<string, string>;
  indexes?: object[];
  selectStar?: string;
  view?: string;
  isMetadataLoading: boolean;
  isExtraMetadataLoading: boolean;
  columns: Column[];
}

interface TableElementProps {
  table: Table;
  actions: {
    removeDataPreview: (table: Table) => void;
    removeTable: (table: Table) => void;
  };
}

const StyledSpan = styled.span`
  color: ${({ theme }) => theme.colors.primary.dark1};
  &: hover {
    color: ${({ theme }) => theme.colors.primary.dark2};
  }
  cursor: pointer;
`;

const Fade = styled.div`
  transition: all ${({ theme }) => theme.transitionTiming}s;
  opacity: ${(props: { hovered: boolean }) => (props.hovered ? 1 : 0)};
`;

const TableElement = ({ table, actions, ...props }: TableElementProps) => {
  const [sortColumns, setSortColumns] = useState(false);
  const [hovered, setHovered] = useState(false);

  const setHover = (hovered: boolean) => {
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
    let partitions;
    let metadata;
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
      const latest = Object.entries(table.partitions?.latest || [])
        .map(([key, value]) => `${key}=${value}`)
        .join('/');

      partitions = (
        <div>
          <small>
            {t('latest partition:')} {latest}
          </small>{' '}
          {partitionClipBoard}
        </div>
      );
    }

    if (table.metadata) {
      metadata = Object.entries(table.metadata).map(([key, value]) => (
        <div>
          <small>
            <strong>{key}:</strong> {value}
          </small>
        </div>
      ));
    }

    if (!partitions && (!metadata || !metadata.length)) {
      // hide partition and metadata card view
      return null;
    }

    return (
      <Card size="small">
        {partitions}
        {metadata}
      </Card>
    );
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
            sortColumns
              ? t('Original table column order')
              : t('Sort columns alphabetically')
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
        cols.sort((a: Column, b: Column) => {
          const colA = a.name.toUpperCase();
          const colB = b.name.toUpperCase();
          return colA < colB ? -1 : colA > colB ? 1 : 0;
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

  return (
    <Collapse.Panel
      {...props}
      key={table.id}
      header={renderHeader()}
      className="TableElement"
      forceRender
    >
      {renderBody()}
    </Collapse.Panel>
  );
};

export default TableElement;
