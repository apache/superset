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
import React, { ReactChildren, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { css } from '@superset-ui/core';
import { FormLabel } from 'src/components/Form';
import Loading from 'src/components/Loading';
import useQueryEditor from 'src/SqlLab/hooks/useQueryEditor';
import { useTranslateQuery } from 'src/hooks/apiResources';
import { useDebounceValue } from 'src/hooks/useDebounceValue';
import { queryEditorSetSelectedText } from '../../actions/sqlLab';

import { StyledAceEditor } from '../AceEditorWrapper';
import SqlDialectSelect from '../SqlDialectSelect';
import useEffectEvent from 'src/hooks/useEffectEvent';

type Props = {
  children: ReactChildren;
  databaseBackend: string;
  queryEditorId: string;
};

export default function SqlDialectEditorPane({
  queryEditorId,
  databaseBackend,
  children,
}: Props) {
  const dispatch = useDispatch();
  const queryEditor = useQueryEditor(queryEditorId, ['id', 'dialect', 'sql']);
  const enabled =
    queryEditor.dialect && queryEditor.dialect !== databaseBackend;
  const debouncedSql = useDebounceValue(queryEditor.sql, 500);
  const { data, isLoading } = useTranslateQuery(
    {
      sql: debouncedSql,
      writeDialect: databaseBackend,
      readDialect: queryEditor.dialect,
    },
    {
      skip: !enabled,
    },
  );
  const setSelectedText = useEffectEvent((selectedText: string) => {
    dispatch(queryEditorSetSelectedText(queryEditor, selectedText));
  });
  useEffect(() => {
    setSelectedText(enabled && data ? data : '');
  }, [data, enabled, setSelectedText]);

  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        height: 100%;
      `}
    >
      <div
        css={css`
          display: flex;
          flex-direction: row;
          gap: 8px;
          align-items: center;
          margin-bottom: 4px;
        `}
      >
        <div
          css={css`
            flex: 1;
          `}
        >
          <SqlDialectSelect
            queryEditorId={queryEditorId}
            defaultDatabase={databaseBackend}
          />
        </div>
        {enabled && (
          <div
            css={css`
              flex: 1;
            `}
          >
            <FormLabel>Transpiled in {databaseBackend}:</FormLabel>
          </div>
        )}
      </div>
      <div
        css={css`
          display: flex;
          flex-direction: row;
          flex: 1;
          height: 100%;
          gap: 8px;
        `}
      >
        {children}
        {enabled && (
          <div
            css={css`
              display: flex;
              flex: 1;
              position: relative;
              flex-direction: column;
            `}
          >
            {(isLoading || queryEditor.sql !== debouncedSql) && <Loading />}

            <StyledAceEditor
              height="100%"
              onChange={() => {}}
              width="100%"
              editorProps={{ $blockScrolling: true }}
              value={data}
            />
          </div>
        )}
      </div>
    </div>
  );
}
