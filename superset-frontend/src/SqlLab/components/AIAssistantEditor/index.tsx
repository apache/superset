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

import { ChangeEvent } from 'react';

import { useDispatch, useSelector } from 'react-redux';

import { css, t, styled, useTheme } from '@superset-ui/core';

import { Button, Icons, Input } from '@superset-ui/core/components';
import { LOG_ACTIONS_AI_ASSISTANT_OPENED } from 'src/logger/LogUtils';
import useLogAction from 'src/logger/useLogAction';

import { setGenerateSqlPrompt } from 'src/SqlLab/actions/sqlLab';
import { SqlLabRootState } from 'src/SqlLab/types';

export interface AiAssistantEditorProps {
  queryEditorId: string;
  onGenerateSql: (prompt: string) => void;
  isGeneratingSql: boolean;
  schema?: string | string[];
  disabledMessage?: string;
}

const StyledButton = styled.span`
  button {
    line-height: 20px;
  }
`;

const StyledToolbar = styled.div`
  ${({ theme }) => css`
    padding: ${theme.sizeUnit * 2}px;
    background: ${theme.colors.grayscale.light5};
    border: 1px solid ${theme.colors.grayscale.light2};
    border-bottom: 0;
    margin-bottom: 0;

    .assist-input {
      display: flex;
      justify-content: space-between;
      align-items: center;
      column-gap: ${theme.sizeUnit}px;
    }

    form {
      margin-block-end: 0;
    }

    .label {
      width: ${theme.sizeUnit * 25}px;
      height: 100%;
      color: ${theme.colors.grayscale.base};
      font-size: ${theme.fontSize}px;
    }
  `}
`;

const DisabledMessage = styled.div`
  ${({ theme }) => css`
    color: ${theme.colors.error.base};
    margin-top: ${theme.sizeUnit * 2}px;
    margin-left: ${theme.sizeUnit * 2}px;
    font-size: ${theme.fontSizeSM}px;
    padding: ${theme.sizeUnit * 2}px;
  `}
`;

const SelectedSchemaMessage = styled.div`
  ${({ theme }) => css`
    color: ${theme.colors.grayscale.base};
    margin-top: ${theme.sizeUnit * 2}px;
    margin-left: ${theme.sizeUnit * 2}px;
    font-size: ${theme.fontSizeSM}px;
    padding: ${theme.sizeUnit * 2}px;
    display: flex;
    align-items: center;
    column-gap: ${theme.sizeUnit}px;
  `}
`;

const onClick = (
  logAction: (name: string, payload: Record<string, any>) => void,
): void => {
  logAction(LOG_ACTIONS_AI_ASSISTANT_OPENED, { shortcut: false });
};

const AiAssistantEditor = ({
  queryEditorId,
  onGenerateSql,
  isGeneratingSql = false,
  schema = [],
  disabledMessage,
}: AiAssistantEditorProps) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const logAction = useLogAction({ queryEditorId });

  const changePrompt = (event: ChangeEvent<HTMLInputElement>) => {
    dispatch(setGenerateSqlPrompt(queryEditorId, event.target.value));
  };

  const prompt = useSelector((state: SqlLabRootState) => {
    const queryEditor = state.sqlLab.queryEditors.find(
      qe => qe.id === queryEditorId,
    );
    if (queryEditor) {
      return queryEditor.queryGenerator?.prompt || '';
    }
    return '';
  });

  const isDisabled = isGeneratingSql || !!disabledMessage;

  return (
    <StyledToolbar>
      <div className="assist-input">
        <span className="label">AI Assist</span>
        <Input
          type="text"
          onChange={changePrompt}
          value={prompt}
          className="form-control input-md"
          placeholder={t('How many employees are located in Bath?')}
          disabled={isDisabled}
          onKeyDown={e => {
            if (!isDisabled && e.key === 'Enter') {
              e.preventDefault();
              onClick(logAction);
              onGenerateSql(prompt);
            }
          }}
        />
        <StyledButton>
          <Button
            buttonSize="small"
            onClick={() => {
              onClick(logAction);
              onGenerateSql(prompt);
            }}
            tooltip={t('Generate SQL with AI') as string}
            disabled={isDisabled}
          >
            <Icons.BulbOutlined
              iconColor={theme.colors.primary.base}
              iconSize="xl"
            />
            {isGeneratingSql ? t('Generating...') : t('Generate SQL')}
          </Button>
        </StyledButton>
      </div>
      {disabledMessage ? (
        <DisabledMessage>{disabledMessage}</DisabledMessage>
      ) : schema && schema.length > 0 ? (
        <SelectedSchemaMessage>
          <Icons.InfoCircleOutlined />
          {`Selecting schema will restrict the AI to generate SQL for only the selected schema. This will increase costs due to skipping the AI cache. Currently selected: ${Array.isArray(schema) ? schema.join(', ') : schema}`}
        </SelectedSchemaMessage>
      ) : null}
    </StyledToolbar>
  );
};

export default AiAssistantEditor;
