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
import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { styled, useTheme } from '@superset-ui/core';
import { AntdDropdown } from 'src/components';
import { Menu } from 'src/components/Menu';
import Icons from 'src/components/Icons';
import { SqlLabRootState, QueryEditor } from 'src/SqlLab/types';
import { queryEditorSetQueryLimit } from 'src/SqlLab/actions/sqlLab';

export interface QueryLimitSelectProps {
  queryEditor: QueryEditor;
  maxRow: number;
  defaultQueryLimit: number;
}

export const LIMIT_DROPDOWN = [10, 100, 1000, 10000, 100000];

export function convertToNumWithSpaces(num: number) {
  return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1 ');
}

const LimitSelectStyled = styled.span`
  ${({ theme }) => `
    .ant-dropdown-trigger {
      align-items: center;
      color: ${theme.colors.grayscale.dark2};
      display: flex;
      font-size: 12px;
      margin-right: ${theme.gridUnit * 2}px;
      text-decoration: none;
      border: 0;
      background: transparent;
      span {
        display: inline-block;
        margin-right: ${theme.gridUnit * 2}px;
        &:last-of-type: {
          margin-right: ${theme.gridUnit * 4}px;
        }
      }
    }
  `}
`;

function renderQueryLimit(
  maxRow: number,
  setQueryLimit: (limit: number) => void,
) {
  // Adding SQL_MAX_ROW value to dropdown
  LIMIT_DROPDOWN.push(maxRow);

  return (
    <Menu>
      {[...new Set(LIMIT_DROPDOWN)].map(limit => (
        <Menu.Item key={`${limit}`} onClick={() => setQueryLimit(limit)}>
          {/* // eslint-disable-line no-use-before-define */}
          <a role="button">{convertToNumWithSpaces(limit)}</a>{' '}
        </Menu.Item>
      ))}
    </Menu>
  );
}

const QueryLimitSelect = ({
  queryEditor,
  maxRow,
  defaultQueryLimit,
}: QueryLimitSelectProps) => {
  const queryLimit = useSelector<SqlLabRootState, number>(
    ({ sqlLab: { unsavedQueryEditor } }) => {
      const updatedQueryEditor = {
        ...queryEditor,
        ...(unsavedQueryEditor.id === queryEditor.id && unsavedQueryEditor),
      };
      return updatedQueryEditor.queryLimit || defaultQueryLimit;
    },
  );
  const dispatch = useDispatch();
  const setQueryLimit = (updatedQueryLimit: number) =>
    dispatch(queryEditorSetQueryLimit(queryEditor, updatedQueryLimit));
  const theme = useTheme();

  return (
    <LimitSelectStyled>
      <AntdDropdown
        overlay={renderQueryLimit(maxRow, setQueryLimit)}
        trigger={['click']}
      >
        <button type="button" onClick={e => e.preventDefault()}>
          <span>LIMIT:</span>
          <span className="limitDropdown">
            {convertToNumWithSpaces(queryLimit)}
          </span>
          <Icons.TriangleDown iconColor={theme.colors.grayscale.base} />
        </button>
      </AntdDropdown>
    </LimitSelectStyled>
  );
};

export default QueryLimitSelect;
