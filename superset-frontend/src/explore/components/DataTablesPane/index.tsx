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
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  MouseEvent,
} from 'react';
import {
  css,
  ensureIsArray,
  GenericDataType,
  JsonObject,
  styled,
  t,
  useTheme,
} from '@superset-ui/core';
import Icons from 'src/components/Icons';
import Tabs from 'src/components/Tabs';
import Loading from 'src/components/Loading';
import { EmptyStateMedium } from 'src/components/EmptyState';
import TableView, { EmptyWrapperType } from 'src/components/TableView';
import { getChartDataRequest } from 'src/components/Chart/chartAction';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
import {
  getItem,
  setItem,
  LocalStorageKeys,
} from 'src/utils/localStorageHelpers';
import {
  CopyToClipboardButton,
  FilterInput,
  RowCount,
  useFilteredTableData,
  useTableColumns,
} from 'src/explore/components/DataTableControl';
import { applyFormattingToTabularData } from 'src/utils/common';
import { useOriginalFormattedTimeColumns } from '../useOriginalFormattedTimeColumns';

const RESULT_TYPES = {
  results: 'results' as const,
  samples: 'samples' as const,
};

const getDefaultDataTablesState = (value: any) => ({
  [RESULT_TYPES.results]: value,
  [RESULT_TYPES.samples]: value,
});

const DATA_TABLE_PAGE_SIZE = 50;

const TableControlsWrapper = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: ${theme.gridUnit * 2}px;

    span {
      flex-shrink: 0;
    }
  `}
`;

const SouthPane = styled.div`
  ${({ theme }) => `
    position: relative;
    background-color: ${theme.colors.grayscale.light5};
    z-index: 5;
    overflow: hidden;

    .ant-tabs {
      height: 100%;
    }

    .ant-tabs-content-holder {
      height: 100%;
    }

    .ant-tabs-content {
      height: 100%;
    }

    .ant-tabs-tabpane {
      display: flex;
      flex-direction: column;
      height: 100%;

      .table-condensed {
        height: 100%;
        overflow: auto;
        margin-bottom: ${theme.gridUnit * 4}px;

        .table {
          margin-bottom: ${theme.gridUnit * 2}px;
        }
      }

      .pagination-container > ul[role='navigation'] {
        margin-top: 0;
      }
    }
  `}
`;

const Error = styled.pre`
  margin-top: ${({ theme }) => `${theme.gridUnit * 4}px`};
`;

interface DataTableProps {
  columnNames: string[];
  columnTypes: GenericDataType[] | undefined;
  datasource: string | undefined;
  filterText: string;
  data: object[] | undefined;
  isLoading: boolean;
  error: string | undefined;
  errorMessage: React.ReactElement | undefined;
  type: 'results' | 'samples';
}

const DataTable = ({
  columnNames,
  columnTypes,
  datasource,
  filterText,
  data,
  isLoading,
  error,
  errorMessage,
  type,
}: DataTableProps) => {
  const originalFormattedTimeColumns =
    useOriginalFormattedTimeColumns(datasource);
  // this is to preserve the order of the columns, even if there are integer values,
  // while also only grabbing the first column's keys
  const columns = useTableColumns(
    columnNames,
    columnTypes,
    data,
    datasource,
    originalFormattedTimeColumns,
  );
  const filteredData = useFilteredTableData(filterText, data);

  if (isLoading) {
    return <Loading />;
  }
  if (error) {
    return <Error>{error}</Error>;
  }
  if (data) {
    if (data.length === 0) {
      const title =
        type === 'samples'
          ? t('No samples were returned for this query')
          : t('No results were returned for this query');
      return <EmptyStateMedium image="document.svg" title={title} />;
    }
    return (
      <TableView
        columns={columns}
        data={filteredData}
        pageSize={DATA_TABLE_PAGE_SIZE}
        noDataText={t('No results')}
        emptyWrapperType={EmptyWrapperType.Small}
        className="table-condensed"
        isPaginationSticky
        showRowCount={false}
        small
      />
    );
  }
  if (errorMessage) {
    const title =
      type === 'samples'
        ? t('Run a query to display samples')
        : t('Run a query to display results');
    return <EmptyStateMedium image="document.svg" title={title} />;
  }
  return null;
};

const TableControls = ({
  data,
  datasourceId,
  onInputChange,
  columnNames,
  isLoading,
}: {
  data: Record<string, any>[];
  datasourceId?: string;
  onInputChange: (input: string) => void;
  columnNames: string[];
  isLoading: boolean;
}) => {
  const originalFormattedTimeColumns =
    useOriginalFormattedTimeColumns(datasourceId);
  const formattedData = useMemo(
    () => applyFormattingToTabularData(data, originalFormattedTimeColumns),
    [data, originalFormattedTimeColumns],
  );
  return (
    <TableControlsWrapper>
      <FilterInput onChangeHandler={onInputChange} />
      <div
        css={css`
          display: flex;
          align-items: center;
        `}
      >
        <RowCount data={data} loading={isLoading} />
        <CopyToClipboardButton data={formattedData} columns={columnNames} />
      </div>
    </TableControlsWrapper>
  );
};

export const DataTablesPane = ({
  queryFormData,
  queryForce,
  onCollapseChange,
  chartStatus,
  ownState,
  errorMessage,
  queriesResponse,
}: {
  queryFormData: Record<string, any>;
  queryForce: boolean;
  chartStatus: string;
  ownState?: JsonObject;
  onCollapseChange: (isOpen: boolean) => void;
  errorMessage?: JSX.Element;
  queriesResponse: Record<string, any>;
}) => {
  const theme = useTheme();
  const [data, setData] = useState(getDefaultDataTablesState(undefined));
  const [isLoading, setIsLoading] = useState(getDefaultDataTablesState(true));
  const [columnNames, setColumnNames] = useState(getDefaultDataTablesState([]));
  const [columnTypes, setColumnTypes] = useState(getDefaultDataTablesState([]));
  const [error, setError] = useState(getDefaultDataTablesState(''));
  const [filterText, setFilterText] = useState(getDefaultDataTablesState(''));
  const [activeTabKey, setActiveTabKey] = useState<string>(
    RESULT_TYPES.results,
  );
  const [isRequestPending, setIsRequestPending] = useState(
    getDefaultDataTablesState(false),
  );
  const [panelOpen, setPanelOpen] = useState(
    getItem(LocalStorageKeys.is_datapanel_open, false),
  );

  const getData = useCallback(
    (resultType: 'samples' | 'results') => {
      setIsLoading(prevIsLoading => ({
        ...prevIsLoading,
        [resultType]: true,
      }));
      return getChartDataRequest({
        formData: queryFormData,
        force: queryForce,
        resultFormat: 'json',
        resultType,
        ownState,
      })
        .then(({ json }) => {
          // Only displaying the first query is currently supported
          if (json.result.length > 1) {
            const data: any[] = [];
            json.result.forEach((item: { data: any[] }) => {
              item.data.forEach((row, i) => {
                if (data[i] !== undefined) {
                  data[i] = { ...data[i], ...row };
                } else {
                  data[i] = row;
                }
              });
            });
            setData(prevData => ({
              ...prevData,
              [resultType]: data,
            }));
          } else {
            setData(prevData => ({
              ...prevData,
              [resultType]: json.result[0].data,
            }));
          }

          const colNames = ensureIsArray(json.result[0].colnames);

          setColumnNames(prevColumnNames => ({
            ...prevColumnNames,
            [resultType]: colNames,
          }));
          setColumnTypes(prevColumnTypes => ({
            ...prevColumnTypes,
            [resultType]: json.result[0].coltypes || [],
          }));
          setIsLoading(prevIsLoading => ({
            ...prevIsLoading,
            [resultType]: false,
          }));
          setError(prevError => ({
            ...prevError,
            [resultType]: undefined,
          }));
        })
        .catch(response => {
          getClientErrorObject(response).then(({ error, message }) => {
            setError(prevError => ({
              ...prevError,
              [resultType]: error || message || t('Sorry, an error occurred'),
            }));
            setIsLoading(prevIsLoading => ({
              ...prevIsLoading,
              [resultType]: false,
            }));
          });
        });
    },
    [queryFormData, columnNames],
  );
  useEffect(() => {
    setItem(LocalStorageKeys.is_datapanel_open, panelOpen);
  }, [panelOpen]);

  useEffect(() => {
    setIsRequestPending(prevState => ({
      ...prevState,
      [RESULT_TYPES.results]: true,
    }));
  }, [queryFormData]);

  useEffect(() => {
    setIsRequestPending(prevState => ({
      ...prevState,
      [RESULT_TYPES.samples]: true,
    }));
  }, [queryFormData?.datasource]);

  useEffect(() => {
    if (queriesResponse && chartStatus === 'success') {
      const { colnames } = queriesResponse[0];
      setColumnNames(prevColumnNames => ({
        ...prevColumnNames,
        [RESULT_TYPES.results]: colnames ?? [],
      }));
    }
  }, [queriesResponse, chartStatus]);

  useEffect(() => {
    if (panelOpen && isRequestPending[RESULT_TYPES.results]) {
      if (errorMessage) {
        setIsRequestPending(prevState => ({
          ...prevState,
          [RESULT_TYPES.results]: false,
        }));
        setIsLoading(prevIsLoading => ({
          ...prevIsLoading,
          [RESULT_TYPES.results]: false,
        }));
        return;
      }
      if (chartStatus === 'loading') {
        setIsLoading(prevIsLoading => ({
          ...prevIsLoading,
          [RESULT_TYPES.results]: true,
        }));
      } else {
        setIsRequestPending(prevState => ({
          ...prevState,
          [RESULT_TYPES.results]: false,
        }));
        getData(RESULT_TYPES.results);
      }
    }
    if (
      panelOpen &&
      isRequestPending[RESULT_TYPES.samples] &&
      activeTabKey === RESULT_TYPES.samples
    ) {
      setIsRequestPending(prevState => ({
        ...prevState,
        [RESULT_TYPES.samples]: false,
      }));
      getData(RESULT_TYPES.samples);
    }
  }, [
    panelOpen,
    isRequestPending,
    getData,
    activeTabKey,
    chartStatus,
    errorMessage,
  ]);

  const handleCollapseChange = useCallback(
    (isOpen: boolean) => {
      onCollapseChange(isOpen);
      setPanelOpen(isOpen);
    },
    [onCollapseChange],
  );

  const handleTabClick = useCallback(
    (tabKey: string, e: MouseEvent) => {
      if (!panelOpen) {
        handleCollapseChange(true);
      } else if (tabKey === activeTabKey) {
        e.preventDefault();
        handleCollapseChange(false);
      }
      setActiveTabKey(tabKey);
    },
    [activeTabKey, handleCollapseChange, panelOpen],
  );

  const CollapseButton = useMemo(() => {
    const caretIcon = panelOpen ? (
      <Icons.CaretUp
        iconColor={theme.colors.grayscale.base}
        aria-label={t('Collapse data panel')}
      />
    ) : (
      <Icons.CaretDown
        iconColor={theme.colors.grayscale.base}
        aria-label={t('Expand data panel')}
      />
    );
    return (
      <TableControlsWrapper>
        {panelOpen ? (
          <span
            role="button"
            tabIndex={0}
            onClick={() => handleCollapseChange(false)}
          >
            {caretIcon}
          </span>
        ) : (
          <span
            role="button"
            tabIndex={0}
            onClick={() => handleCollapseChange(true)}
          >
            {caretIcon}
          </span>
        )}
      </TableControlsWrapper>
    );
  }, [handleCollapseChange, panelOpen, theme.colors.grayscale.base]);

  return (
    <SouthPane data-test="some-purposeful-instance">
      <Tabs
        fullWidth={false}
        tabBarExtraContent={CollapseButton}
        activeKey={panelOpen ? activeTabKey : ''}
        onTabClick={handleTabClick}
      >
        <Tabs.TabPane tab={t('Results')} key={RESULT_TYPES.results}>
          <TableControls
            data={data[RESULT_TYPES.results]}
            columnNames={columnNames[RESULT_TYPES.results]}
            datasourceId={queryFormData?.datasource}
            onInputChange={input =>
              setFilterText(prevState => ({
                ...prevState,
                [RESULT_TYPES.results]: input,
              }))
            }
            isLoading={isLoading[RESULT_TYPES.results]}
          />
          <DataTable
            isLoading={isLoading[RESULT_TYPES.results]}
            data={data[RESULT_TYPES.results]}
            datasource={queryFormData?.datasource}
            columnNames={columnNames[RESULT_TYPES.results]}
            columnTypes={columnTypes[RESULT_TYPES.results]}
            filterText={filterText[RESULT_TYPES.results]}
            error={error[RESULT_TYPES.results]}
            errorMessage={errorMessage}
            type={RESULT_TYPES.results}
          />
        </Tabs.TabPane>
        <Tabs.TabPane tab={t('Samples')} key={RESULT_TYPES.samples}>
          <TableControls
            data={data[RESULT_TYPES.samples]}
            columnNames={columnNames[RESULT_TYPES.samples]}
            datasourceId={queryFormData?.datasource}
            onInputChange={input =>
              setFilterText(prevState => ({
                ...prevState,
                [RESULT_TYPES.samples]: input,
              }))
            }
            isLoading={isLoading[RESULT_TYPES.samples]}
          />
          <DataTable
            isLoading={isLoading[RESULT_TYPES.samples]}
            data={data[RESULT_TYPES.samples]}
            datasource={queryFormData?.datasource}
            columnNames={columnNames[RESULT_TYPES.samples]}
            columnTypes={columnTypes[RESULT_TYPES.samples]}
            filterText={filterText[RESULT_TYPES.samples]}
            error={error[RESULT_TYPES.samples]}
            errorMessage={errorMessage}
            type={RESULT_TYPES.samples}
          />
        </Tabs.TabPane>
      </Tabs>
    </SouthPane>
  );
};
