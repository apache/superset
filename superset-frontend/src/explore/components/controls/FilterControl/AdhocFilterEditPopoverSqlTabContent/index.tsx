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
import { useEffect, useRef, useMemo } from 'react';
import { Select } from 'src/components';
import { styled, t, useTheme } from '@superset-ui/core';
import { SQLEditor } from 'src/components/AsyncAceEditor';
import sqlKeywords from 'src/SqlLab/utils/sqlKeywords';
import { getColumnKeywords } from 'src/explore/controlUtils/getColumnKeywords';
import AdhocFilter from 'src/explore/components/controls/FilterControl/AdhocFilter';
import { OptionSortType } from 'src/explore/types';
import { ColumnMeta } from '@superset-ui/chart-controls';
import { Clauses, ExpressionTypes } from '../types';

const StyledSelect = styled(Select)`
  ${({ theme }) => `
    width: ${theme.gridUnit * 30}px;
    marginRight: ${theme.gridUnit}px;
  `}
`;

export default function AdhocFilterEditPopoverSqlTabContent({
  adhocFilter,
  onChange,
  options,
  height,
}: {
  adhocFilter: AdhocFilter;
  onChange: (filter: AdhocFilter) => void;
  options: OptionSortType[];
  height: number;
}) {
  const aceEditorRef = useRef(null);
  const theme = useTheme();

  useEffect(() => {
    // @ts-ignore
    aceEditorRef?.current?.editor.resize();
  }, [adhocFilter]);

  const onSqlExpressionClauseChange = (clause: string) => {
    onChange(
      adhocFilter.duplicateWith({
        clause,
        expressionType: ExpressionTypes.Sql,
      }),
    );
  };

  const onSqlExpressionChange = (sqlExpression: string) => {
    onChange(
      adhocFilter.duplicateWith({
        sqlExpression,
        expressionType: ExpressionTypes.Sql,
      }),
    );
  };

  const keywords = useMemo(
    () =>
      sqlKeywords.concat(
        getColumnKeywords(
          options.filter(
            (option): option is ColumnMeta =>
              typeof option === 'object' &&
              option !== null &&
              'column_name' in option &&
              typeof option.column_name === 'string' &&
              'type' in option,
          ),
        ),
      ),
    [sqlKeywords],
  );

  const selectOptions = useMemo(
    () =>
      Object.values(Clauses).map(clause => ({
        label: clause,
        value: clause,
      })),
    [Clauses],
  );

  return (
    <span>
      <div className="filter-edit-clause-section">
        <div>
          <StyledSelect
            options={selectOptions}
            ariaLabel={t('Select column')}
            placeholder={t('choose WHERE or HAVING...')}
            value={adhocFilter.clause}
            onChange={onSqlExpressionClauseChange}
          />
        </div>
        <span className="filter-edit-clause-info">
          <strong>WHERE</strong> {t('Filters by columns')}
          <br />
          <strong>HAVING</strong> {t('Filters by metrics')}
        </span>
      </div>
      <div css={{ marginTop: theme.gridUnit * 4 }}>
        <SQLEditor
          ref={aceEditorRef}
          keywords={keywords}
          height={`${height - 130}px`}
          onChange={onSqlExpressionChange}
          width="100%"
          showGutter={false}
          value={adhocFilter.sqlExpression || adhocFilter.translateToSql()}
          editorProps={{ $blockScrolling: true }}
          enableLiveAutocompletion
          className="filter-sql-editor"
          wrapEnabled
        />
      </div>
    </span>
  );
}
