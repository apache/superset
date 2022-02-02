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
import React, { useCallback, useMemo } from 'react';
import {
  css,
  GenericDataType,
  getTimeFormatter,
  styled,
  t,
  useTheme,
} from '@superset-ui/core';
import { Global } from '@emotion/react';
import { Column } from 'react-table';
import debounce from 'lodash/debounce';
import { useDispatch, useSelector } from 'react-redux';
import { Input, Space } from 'src/common/components';
import {
  BOOL_FALSE_DISPLAY,
  BOOL_TRUE_DISPLAY,
  SLOW_DEBOUNCE,
} from 'src/constants';
import { Radio } from 'src/components/Radio';
import Icons from 'src/components/Icons';
import Button from 'src/components/Button';
import Popover from 'src/components/Popover';
import { prepareCopyToClipboardTabularData } from 'src/utils/common';
import CopyToClipboard from 'src/components/CopyToClipboard';
import RowCountLabel from 'src/explore/components/RowCountLabel';
import { ExplorePageState } from 'src/explore/reducers/getInitialState';
import {
  setTimeFormattedColumn,
  unsetTimeFormattedColumn,
} from 'src/explore/actions/exploreActions';

export const CopyButton = styled(Button)`
  font-size: ${({ theme }) => theme.typography.sizes.s}px;

  // needed to override button's first-of-type margin: 0
  && {
    margin: 0 ${({ theme }) => theme.gridUnit * 2}px;
  }

  i {
    padding: 0 ${({ theme }) => theme.gridUnit}px;
  }
`;

const CopyNode = (
  <CopyButton buttonSize="xsmall" aria-label={t('Copy')}>
    <i className="fa fa-clipboard" />
  </CopyButton>
);

export const CopyToClipboardButton = ({
  data,
  columns,
}: {
  data?: Record<string, any>;
  columns?: string[];
}) => (
  <CopyToClipboard
    text={
      data && columns ? prepareCopyToClipboardTabularData(data, columns) : ''
    }
    wrapped={false}
    copyNode={CopyNode}
  />
);

export const FilterInput = ({
  onChangeHandler,
}: {
  onChangeHandler(filterText: string): void;
}) => {
  const debouncedChangeHandler = debounce(onChangeHandler, SLOW_DEBOUNCE);
  return (
    <Input
      placeholder={t('Search')}
      onChange={(event: any) => {
        const filterText = event.target.value;
        debouncedChangeHandler(filterText);
      }}
    />
  );
};

export const RowCount = ({
  data,
  loading,
}: {
  data?: Record<string, any>[];
  loading: boolean;
}) => (
  <RowCountLabel
    rowcount={data?.length ?? 0}
    loading={loading}
    suffix={t('rows retrieved')}
  />
);

enum FormatPickerValue {
  formatted,
  epoch,
}

const FormatPicker = ({
  onChange,
  value,
}: {
  onChange: any;
  value: FormatPickerValue;
}) => (
  <Radio.Group value={value} onChange={onChange}>
    <Space direction="vertical">
      <Radio value={FormatPickerValue.epoch}>{t('Epoch')}</Radio>
      <Radio value={FormatPickerValue.formatted}>{t('Formatted date')}</Radio>
    </Space>
  </Radio.Group>
);

const FormatPickerContainer = styled.div`
  display: flex;
  flex-direction: column;

  padding: ${({ theme }) => `${theme.gridUnit * 4}px`};
`;

const FormatPickerLabel = styled.span`
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  color: ${({ theme }) => theme.colors.grayscale.base};
  margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;
  text-transform: uppercase;
`;

const DataTableHeaderCell = ({
  columnName,
  type,
  datasourceId,
  timeFormattedColumnIndex,
}: {
  columnName: string;
  type?: GenericDataType;
  datasourceId?: string;
  timeFormattedColumnIndex: number;
}) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const isColumnTimeFormatted = timeFormattedColumnIndex > -1;

  const onChange = useCallback(
    e => {
      if (!datasourceId) {
        return;
      }
      if (e.target.value === FormatPickerValue.epoch && isColumnTimeFormatted) {
        dispatch(
          unsetTimeFormattedColumn(datasourceId, timeFormattedColumnIndex),
        );
      } else if (
        e.target.value === FormatPickerValue.formatted &&
        !isColumnTimeFormatted
      ) {
        dispatch(setTimeFormattedColumn(datasourceId, columnName));
      }
    },
    [
      timeFormattedColumnIndex,
      columnName,
      datasourceId,
      dispatch,
      isColumnTimeFormatted,
    ],
  );
  const overlayContent = useMemo(
    () =>
      datasourceId ? ( // eslint-disable-next-line jsx-a11y/no-static-element-interactions
        <FormatPickerContainer onClick={e => e.stopPropagation()}>
          {/* hack to disable click propagation from popover content to table header, which triggers sorting column */}
          <Global
            styles={css`
              .column-formatting-popover .ant-popover-inner-content {
                padding: 0;
              }
            `}
          />
          <FormatPickerLabel>{t('Column Formatting')}</FormatPickerLabel>
          <FormatPicker
            onChange={onChange}
            value={
              isColumnTimeFormatted
                ? FormatPickerValue.formatted
                : FormatPickerValue.epoch
            }
          />
        </FormatPickerContainer>
      ) : null,
    [datasourceId, isColumnTimeFormatted, onChange],
  );

  return type === GenericDataType.TEMPORAL && datasourceId ? (
    <span>
      <Popover
        overlayClassName="column-formatting-popover"
        trigger="click"
        content={overlayContent}
        placement="bottomLeft"
        arrowPointAtCenter
      >
        <Icons.SettingOutlined
          iconSize="m"
          iconColor={theme.colors.grayscale.light1}
          css={{ marginRight: `${theme.gridUnit}px` }}
          onClick={e => e.stopPropagation()}
        />
      </Popover>
      {columnName}
    </span>
  ) : (
    <span>{columnName}</span>
  );
};

export const useFilteredTableData = (
  filterText: string,
  data?: Record<string, any>[],
) => {
  const rowsAsStrings = useMemo(
    () =>
      data?.map((row: Record<string, any>) =>
        Object.values(row).map(value => value?.toString().toLowerCase()),
      ) ?? [],
    [data],
  );

  return useMemo(() => {
    if (!data?.length) {
      return [];
    }
    return data.filter((_, index: number) =>
      rowsAsStrings[index].some(value =>
        value?.includes(filterText.toLowerCase()),
      ),
    );
  }, [data, filterText, rowsAsStrings]);
};

const timeFormatter = getTimeFormatter('%Y-%m-%d %H:%M:%S');

export const useTableColumns = (
  colnames?: string[],
  coltypes?: GenericDataType[],
  data?: Record<string, any>[],
  datasourceId?: string,
  moreConfigs?: { [key: string]: Partial<Column> },
) => {
  const timeFormattedColumns = useSelector<ExplorePageState, string[]>(state =>
    datasourceId ? state.explore.timeFormattedColumns[datasourceId] ?? [] : [],
  );

  return useMemo(
    () =>
      colnames && data?.length
        ? colnames
            .filter((column: string) => Object.keys(data[0]).includes(column))
            .map((key, index) => {
              const timeFormattedColumnIndex =
                coltypes?.[index] === GenericDataType.TEMPORAL
                  ? timeFormattedColumns.indexOf(key)
                  : -1;
              return {
                id: key,
                accessor: row => row[key],
                // When the key is empty, have to give a string of length greater than 0
                Header: (
                  <DataTableHeaderCell
                    columnName={key}
                    type={coltypes?.[index]}
                    datasourceId={datasourceId}
                    timeFormattedColumnIndex={timeFormattedColumnIndex}
                  />
                ),
                Cell: ({ value }) => {
                  if (value === true) {
                    return BOOL_TRUE_DISPLAY;
                  }
                  if (value === false) {
                    return BOOL_FALSE_DISPLAY;
                  }
                  if (timeFormattedColumnIndex > -1) {
                    return timeFormatter(value);
                  }
                  return String(value);
                },
                ...moreConfigs?.[key],
              } as Column;
            })
        : [],
    [colnames, data, coltypes, datasourceId, moreConfigs, timeFormattedColumns],
  );
};
