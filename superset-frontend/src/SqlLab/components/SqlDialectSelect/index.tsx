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
import { useDispatch } from 'react-redux';
import { styled, useTheme } from '@superset-ui/core';
import { AntdDropdown } from 'src/components';
import { Menu } from 'src/components/Menu';
import Icons from 'src/components/Icons';
import { queryEditorSetSqlDialect } from 'src/SqlLab/actions/sqlLab';
import useQueryEditor from 'src/SqlLab/hooks/useQueryEditor';

export interface SqlDialectSelectProps {
  queryEditorId: string;
  defaultDatabase: string;
}

export const DIALECT_DROPDOWN = [
  'bigquery',
  'clickhouse',
  'databricks',
  'drill',
  'duckdb',
  'hive',
  'mssql',
  'mysql',
  'oracle',
  'postgresql',
  'presto',
  'redshift',
  'snowflake',
  'spark',
  'sqlite',
  'starrocks',
  'tableau',
  'teradata',
  'trino',
  'tsql',
];

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
  selected: string,
  setDialect: (dialect: string) => void,
) {
  return (
    <Menu selectedKeys={[selected]}>
      {[...new Set(DIALECT_DROPDOWN)].map(sqlDialect => (
        <Menu.Item key={sqlDialect} onClick={() => setDialect(sqlDialect)}>
          {/* // eslint-disable-line no-use-before-define */}
          <a role="button">{sqlDialect}</a>{' '}
        </Menu.Item>
      ))}
    </Menu>
  );
}

const SqlDialectSelect = ({
  queryEditorId,
  defaultDatabase,
}: SqlDialectSelectProps) => {
  const theme = useTheme();
  const dispatch = useDispatch();

  const queryEditor = useQueryEditor(queryEditorId, ['id', 'dialect']);
  const setQueryLimit = (sqlDialect: string) =>
    dispatch(queryEditorSetSqlDialect(queryEditor, sqlDialect));
  const sqlDialect = queryEditor?.dialect || defaultDatabase;

  return (
    <LimitSelectStyled>
      <AntdDropdown
        overlay={renderQueryLimit(sqlDialect, setQueryLimit)}
        trigger={['click']}
      >
        <button type="button" onClick={e => e.preventDefault()}>
          <span className="limitDropdown">{sqlDialect}</span>
          <Icons.TriangleDown iconColor={theme.colors.grayscale.base} />
        </button>
      </AntdDropdown>
    </LimitSelectStyled>
  );
};

export default SqlDialectSelect;
