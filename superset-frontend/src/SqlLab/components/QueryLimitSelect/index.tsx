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
import { useDispatch } from 'react-redux';
import { styled, useTheme, t } from '@superset-ui/core';
import { AntdDropdown } from 'src/components';
import { Menu } from 'src/components/Menu';
import Icons from 'src/components/Icons';
import { queryEditorSetQueryLimit } from 'src/SqlLab/actions/sqlLab';
import useQueryEditor from 'src/SqlLab/hooks/useQueryEditor';

export interface QueryLimitSelectProps {
  queryEditorId: string;
  maxRow: number;
  defaultQueryLimit: number;
}

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
  const limitDropdown = [];

  // Construct limit dropdown as increasing powers of ten until we reach SQL_MAX_ROW
  for (let i = 10; i < maxRow; i *= 10) {
    limitDropdown.push(i);
  }
  limitDropdown.push(maxRow);

  return (
    <Menu>
      {[...new Set(limitDropdown)].map(limit => (
        <Menu.Item key={`${limit}`} onClick={() => setQueryLimit(limit)}>
          {/* // eslint-disable-line no-use-before-define */}
          {convertToNumWithSpaces(limit)}{' '}
        </Menu.Item>
      ))}
    </Menu>
  );
}

const QueryLimitSelect = ({
  queryEditorId,
  maxRow,
  defaultQueryLimit,
}: QueryLimitSelectProps) => {
  const theme = useTheme();
  const dispatch = useDispatch();

  const queryEditor = useQueryEditor(queryEditorId, ['id', 'queryLimit']);
  const queryLimit = queryEditor.queryLimit || defaultQueryLimit;
  const setQueryLimit = (updatedQueryLimit: number) =>
    dispatch(queryEditorSetQueryLimit(queryEditor, updatedQueryLimit));

  return (
    <LimitSelectStyled>
      <AntdDropdown
        overlay={renderQueryLimit(maxRow, setQueryLimit)}
        trigger={['click']}
      >
        <button type="button" onClick={e => e.preventDefault()}>
          <span>{t('LIMIT')}:</span>
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
