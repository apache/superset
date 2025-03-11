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
import { useState, useRef, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import type { Table } from 'src/SqlLab/types';
import Collapse from 'src/components/Collapse';
import Card from 'src/components/Card';
import ButtonGroup from 'src/components/ButtonGroup';
import { css, t, styled, useTheme } from '@superset-ui/core';
import { debounce } from 'lodash';

import {
  removeDataPreview,
  removeTables,
  addDangerToast,
  syncTable,
} from 'src/SqlLab/actions/sqlLab';
import {
  tableApiUtil,
  useTableExtendedMetadataQuery,
  useTableMetadataQuery,
} from 'src/hooks/apiResources';
import { Tooltip } from 'src/components/Tooltip';
import CopyToClipboard from 'src/components/CopyToClipboard';
import { IconTooltip } from 'src/components/IconTooltip';
import ModalTrigger from 'src/components/ModalTrigger';
import Loading from 'src/components/Loading';
import useEffectEvent from 'src/hooks/useEffectEvent';
import { ActionType } from 'src/types/Action';
import ColumnElement, { ColumnKeyTypeType } from '../ColumnElement';
import ShowSQL from '../ShowSQL';

export interface Column {
  name: string;
  keys?: { type: ColumnKeyTypeType }[];
  type: string;
}

export interface TableElementProps {
  table: Table;
}

const StyledSpan = styled.span`
  color: ${({ theme }) => theme.colors.primary.dark1};
  &:hover {
    color: ${({ theme }) => theme.colors.primary.dark2};
  }
  cursor: pointer;
`;

const Fade = styled.div`
  transition: all ${({ theme }) => theme.transitionTiming}s;
  opacity: ${(props: { hovered: boolean }) => (props.hovered ? 1 : 0)};
`;

const StyledCollapsePanel = styled(Collapse.Panel)`
  ${({ theme }) => css`
    & {
      .ws-el-controls {
        margin-right: ${-theme.gridUnit}px;
        display: flex;
      }

      .header-container {
        display: flex;
        flex: 1;
        align-items: center;
        width: 100%;

        .table-name {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-size: ${theme.typography.sizes.l}px;
          flex: 1;
        }

        .header-right-side {
          margin-left: auto;
          display: flex;
          align-items: center;
          margin-right: ${theme.gridUnit * 8}px;
        }
      }
    }
  `}
`;

const TableElement = ({ table, ...props }: TableElementProps) => {
  const { dbId, catalog, schema, name, expanded } = table;
  const theme = useTheme();
  const dispatch = useDispatch();
  const {
    currentData: tableMetadata,
    isSuccess: isMetadataSuccess,
    isFetching: isMetadataFetching,
    isError: hasMetadataError,
  } = useTableMetadataQuery(
    {
      dbId,
      catalog,
      schema,
      table: name,
    },
    { skip: !expanded },
  );
  const {
    currentData: tableExtendedMetadata,
    isSuccess: isExtraMetadataSuccess,
    isLoading: isExtraMetadataLoading,
    isError: hasExtendedMetadataError,
  } = useTableExtendedMetadataQuery(
    {
      dbId,
      catalog,
      schema,
      table: name,
    },
    { skip: !expanded },
  );

  useEffect(() => {
    if (hasMetadataError || hasExtendedMetadataError) {
      dispatch(
        addDangerToast(t('An error occurred while fetching table metadata')),
      );
    }
  }, [hasMetadataError, hasExtendedMetadataError, dispatch]);

  const tableData = {
    ...tableMetadata,
    ...tableExtendedMetadata,
  };

  // TODO: migrate syncTable logic by SIP-93
  const syncTableMetadata = useEffectEvent(() => {
    const { initialized } = table;
    if (!initialized) {
      dispatch(syncTable(table, tableData));
    }
  });

  useEffect(() => {
    if (isMetadataSuccess && isExtraMetadataSuccess) {
      syncTableMetadata();
    }
  }, [isMetadataSuccess, isExtraMetadataSuccess, syncTableMetadata]);

  const [sortColumns, setSortColumns] = useState(false);
  const [hovered, setHovered] = useState(false);
  const tableNameRef = useRef<HTMLInputElement>(null);

  const setHover = (hovered: boolean) => {
    debounce(() => setHovered(hovered), 100)();
  };

  const removeTable = () => {
    dispatch(removeDataPreview(table));
    dispatch(removeTables([table]));
  };

  const toggleSortColumns = () => {
    setSortColumns(prevState => !prevState);
  };

  const refreshTableMetadata = () => {
    dispatch(
      tableApiUtil.invalidateTags([{ type: 'TableMetadatas', id: name }]),
    );
    dispatch(syncTable(table, tableData));
  };

  const renderWell = () => {
    let partitions;
    let metadata;
    if (tableData.partitions) {
      let partitionQuery;
      let partitionClipBoard;
      if (tableData.partitions.partitionQuery) {
        ({ partitionQuery } = tableData.partitions);
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
      const latest = Object.entries(tableData.partitions?.latest || [])
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

    if (tableData.metadata) {
      metadata = Object.entries(tableData.metadata).map(([key, value]) => (
        <div>
          <small>
            <strong>{key}:</strong> {value}
          </small>
        </div>
      ));
      if (!metadata?.length) {
        // hide metadata card view
        return null;
      }
    }

    if (!partitions) {
      // hide partition card view
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
    const KEYS_FOR_TABLE_TEXT = t('Keys for table');
    if (tableData?.indexes?.length) {
      keyLink = (
        <ModalTrigger
          modalTitle={`${KEYS_FOR_TABLE_TEXT} ${name}`}
          modalBody={tableData.indexes.map((ix, i) => (
            <pre key={i}>{JSON.stringify(ix, null, '  ')}</pre>
          ))}
          triggerNode={
            <IconTooltip
              className="fa fa-key pull-left m-l-2"
              tooltip={t('View keys & indexes (%s)', tableData.indexes.length)}
            />
          }
        />
      );
    }
    return (
      <ButtonGroup
        css={css`
          column-gap: ${theme.gridUnit * 1.5}px;
          margin-right: ${theme.gridUnit}px;
          & span {
            display: flex;
            justify-content: center;
            width: ${theme.gridUnit * 4}px;
          }
        `}
      >
        <IconTooltip
          className="fa fa-refresh pull-left m-l-2 pointer"
          onClick={refreshTableMetadata}
          tooltip={t('Refresh table schema')}
        />
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
        {tableData.selectStar && (
          <CopyToClipboard
            copyNode={
              <IconTooltip
                aria-label="Copy"
                tooltip={t('Copy SELECT statement to the clipboard')}
              >
                <i aria-hidden className="fa fa-clipboard pull-left m-l-2" />
              </IconTooltip>
            }
            text={tableData.selectStar}
            shouldShowText={false}
          />
        )}
        {tableData.view && (
          <ShowSQL
            sql={tableData.view}
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

  const renderHeader = () => {
    const element: HTMLInputElement | null = tableNameRef.current;
    let trigger = [] as ActionType[];
    if (element && element.offsetWidth < element.scrollWidth) {
      trigger = ['hover'];
    }

    return (
      <div
        data-test="table-element-header-container"
        className="clearfix header-container"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <Tooltip
          id="copy-to-clipboard-tooltip"
          style={{ cursor: 'pointer' }}
          title={name}
          trigger={trigger}
        >
          <StyledSpan
            data-test="collapse"
            ref={tableNameRef}
            className="table-name"
          >
            <strong>{name}</strong>
          </StyledSpan>
        </Tooltip>

        <div className="pull-right header-right-side">
          {isMetadataFetching || isExtraMetadataLoading ? (
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
  };

  const renderBody = () => {
    let cols;
    if (tableData.columns) {
      cols = tableData.columns.slice();
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
        data-test="table-element"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        css={{ paddingTop: 6 }}
      >
        {renderWell()}
        <div>
          {cols?.map(col => <ColumnElement column={col} key={col.name} />)}
        </div>
      </div>
    );
    return metadata;
  };

  return (
    <StyledCollapsePanel
      {...props}
      key={table.id}
      header={renderHeader()}
      className="TableElement"
      forceRender
    >
      {renderBody()}
    </StyledCollapsePanel>
  );
};

export default TableElement;
