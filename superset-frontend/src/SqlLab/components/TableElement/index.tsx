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
import { useDispatch, useSelector } from 'react-redux';
import type { QueryEditor, SqlLabRootState, Table } from 'src/SqlLab/types';
import {
  ButtonGroup,
  Card,
  Collapse,
  Tooltip,
  Flex,
  IconTooltip,
  Loading,
  ModalTrigger,
  type CollapseProps,
} from '@superset-ui/core/components';
import { CopyToClipboard } from 'src/components';
import { t, styled, useTheme } from '@superset-ui/core';
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
import useEffectEvent from 'src/hooks/useEffectEvent';
import { ActionType } from 'src/types/Action';
import { Icons } from '@superset-ui/core/components/Icons';
import { Space } from '@superset-ui/core/components/Space';
import ColumnElement, { ColumnKeyTypeType } from '../ColumnElement';
import ShowSQL from '../ShowSQL';

export interface Column {
  name: string;
  keys?: { type: ColumnKeyTypeType }[];
  type: string;
}

export interface TableElementProps extends CollapseProps {
  table: Table;
}

const StyledSpan = styled.span`
  cursor: pointer;
`;

const Fade = styled.div`
  transition: all ${({ theme }) => theme.motionDurationMid};
  opacity: ${(props: { hovered: boolean }) => (props.hovered ? 1 : 0)};
`;

const TableElement = ({ table, ...props }: TableElementProps) => {
  const { dbId, catalog, schema, name, expanded, id } = table;
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
  const tableData = {
    ...tableMetadata,
    ...tableExtendedMetadata,
  };
  const queryEditors = useSelector<SqlLabRootState, QueryEditor[]>(
    state => state.sqlLab.queryEditors,
  );
  const currentTable = { ...tableData, ...table };
  const { queryEditorId } = currentTable;
  const queryEditor = queryEditors.find(
    qe => qe.id === queryEditorId || qe.tabViewId === queryEditorId,
  );
  const currentQueryEditorId = queryEditor?.tabViewId || queryEditorId;

  useEffect(() => {
    if (hasMetadataError || hasExtendedMetadataError) {
      dispatch(
        addDangerToast(t('An error occurred while fetching table metadata')),
      );
    }
  }, [hasMetadataError, hasExtendedMetadataError, dispatch]);

  // TODO: migrate syncTable logic by SIP-93
  const syncTableMetadata = useEffectEvent(() => {
    const { initialized } = table;
    // if not a valid number, wait for backend to assign one
    const hasFinalQueryEditorId =
      currentQueryEditorId &&
      !Number.isNaN(Number(currentQueryEditorId)) &&
      currentTable.queryEditorId !== currentQueryEditorId;
    if (!initialized && hasFinalQueryEditorId) {
      dispatch(syncTable(currentTable, tableData, currentQueryEditorId));
    }
  });

  useEffect(() => {
    if (isMetadataSuccess && isExtraMetadataSuccess) {
      syncTableMetadata();
    }
  }, [
    isMetadataSuccess,
    isExtraMetadataSuccess,
    currentQueryEditorId,
    syncTableMetadata,
  ]);

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
            copyNode={<Icons.CopyOutlined iconSize="s" />}
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
              className="pull-left"
              tooltip={t('View keys & indexes (%s)', tableData.indexes.length)}
            >
              <Icons.TableOutlined
                iconSize="m"
                iconColor={theme.colorPrimary}
              />
            </IconTooltip>
          }
        />
      );
    }
    return (
      <Flex style={{ height: 22 }} align="center">
        {isMetadataFetching || isExtraMetadataLoading ? (
          <Loading position="inline" />
        ) : (
          <Fade
            data-test="fade"
            hovered={hovered}
            onClick={e => e.stopPropagation()}
          >
            <ButtonGroup>
              <Space size="small">
                <IconTooltip
                  className="pull-left pointer"
                  onClick={refreshTableMetadata}
                  tooltip={t('Refresh table schema')}
                >
                  <Icons.SyncOutlined
                    iconSize="m"
                    iconColor={theme.colorIcon}
                  />
                </IconTooltip>
                {keyLink}
                <IconTooltip
                  onClick={toggleSortColumns}
                  tooltip={
                    sortColumns
                      ? t('Original table column order')
                      : t('Sort columns alphabetically')
                  }
                >
                  <Icons.SortAscendingOutlined
                    iconSize="m"
                    aria-hidden
                    iconColor={
                      sortColumns ? theme.colorIcon : theme.colorTextDisabled
                    }
                  />
                </IconTooltip>
                {tableData.selectStar && (
                  <CopyToClipboard
                    copyNode={
                      <IconTooltip
                        aria-label={t('Copy')}
                        tooltip={t('Copy SELECT statement to the clipboard')}
                      >
                        <Icons.CopyOutlined
                          iconSize="m"
                          aria-hidden
                          iconColor={theme.colorIcon}
                        />
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
                  className=" table-remove pull-left pointer"
                  onClick={removeTable}
                  tooltip={t('Remove table preview')}
                >
                  <Icons.CloseOutlined
                    iconSize="m"
                    aria-hidden
                    iconColor={theme.colorIcon}
                  />
                </IconTooltip>
              </Space>
            </ButtonGroup>
          </Fade>
        )}
      </Flex>
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
      <div data-test="table-element" css={{ paddingTop: 6 }}>
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
    <Collapse
      activeKey={props.activeKey}
      expandIconPosition="end"
      onChange={props.onChange}
      ghost
      items={[
        {
          key: id,
          label: renderHeader(),
          children: renderBody(),
          extra: renderControls(),
          onMouseEnter: () => setHover(true),
          onMouseLeave: () => setHover(false),
        },
      ]}
    />
  );
};

export default TableElement;
