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
import { FormControl } from 'react-bootstrap';
import Button from 'src/components/Button';
import RowCountLabel from './RowCountLabel';
import {
  applyFormattingToTabularData,
  prepareCopyToClipboardTabularData,
} from 'src/utils/common';
import CopyToClipboard from 'src/components/CopyToClipboard';

const CopyButton = styled(Button)`
  font-size: ${({ theme }) => theme.typography.sizes.s}px;

  // needed to override button's first-of-type margin: 0
  && {
    margin: 0 ${({ theme }) => theme.gridUnit * 2}px;
  }

  i {
    padding: 0;
  }
`;

export const CopyToClipboardButton = ({ data }) => (
  <CopyToClipboard
    text={data ? prepareCopyToClipboardTabularData(data) : ''}
    wrapped={false}
    copyNode={
      <CopyButton buttonSize="xs">
        <i className="fa fa-clipboard" />
      </CopyButton>
    }
  />
);

export const FilterInput = ({ filterText, onChangeHandler }) => (
  <FormControl
    placeholder={t('Search')}
    bsSize="sm"
    value={filterText}
    onChange={onChangeHandler}
  />
);

export const RowCount = ({ data }) => (
  <RowCountLabel rowcount={data?.length ?? 0} suffix={t('rows retrieved')} />
);

export const useFilteredTableData = (data, filterText) =>
  useMemo(() => {
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

export const useTableColumns = data =>
  useMemo(
    () =>
      data?.length
        ? Object.keys(data[0]).map(key => ({ accessor: key, Header: key }))
        : [],
    [data],
  );
