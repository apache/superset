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
import React, { useMemo } from 'react';
import { styled, t } from '@superset-ui/core';
import { Column } from 'react-table';
import debounce from 'lodash/debounce';
import { Input } from 'src/common/components';
import {
  BOOL_FALSE_DISPLAY,
  BOOL_TRUE_DISPLAY,
  SLOW_DEBOUNCE,
} from 'src/constants';
import Button from 'src/components/Button';
import { prepareCopyToClipboardTabularData } from 'src/utils/common';
import CopyToClipboard from 'src/components/CopyToClipboard';
import RowCountLabel from 'src/explore/components/RowCountLabel';

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

export const useTableColumns = (
  colnames?: string[],
  data?: Record<string, any>[],
  moreConfigs?: { [key: string]: Partial<Column> },
) =>
  useMemo(
    () =>
      colnames && data?.length
        ? colnames
            .filter((column: string) => Object.keys(data[0]).includes(column))
            .map(
              key =>
                ({
                  accessor: row => row[key],
                  // When the key is empty, have to give a string of length greater than 0
                  Header: key || ' ',
                  Cell: ({ value }) => {
                    if (value === true) {
                      return BOOL_TRUE_DISPLAY;
                    }
                    if (value === false) {
                      return BOOL_FALSE_DISPLAY;
                    }
                    return String(value);
                  },
                  ...moreConfigs?.[key],
                } as Column),
            )
        : [],
    [data, moreConfigs],
  );
