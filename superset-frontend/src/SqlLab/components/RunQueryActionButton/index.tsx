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
import { useMemo, FC, ReactElement } from 'react';

import { t } from '@apache-superset/core';
import { styled, useTheme, SupersetTheme } from '@apache-superset/core/ui';

import { Button, DropdownButton } from '@superset-ui/core/components';
import { IconType, Icons } from '@superset-ui/core/components/Icons';
import { detectOS } from 'src/utils/common';
import { QueryButtonProps } from 'src/SqlLab/types';
import useQueryEditor from 'src/SqlLab/hooks/useQueryEditor';
import {
  LOG_ACTIONS_SQLLAB_RUN_QUERY,
  LOG_ACTIONS_SQLLAB_STOP_QUERY,
} from 'src/logger/LogUtils';
import useLogAction from 'src/logger/useLogAction';

export interface RunQueryActionButtonProps {
  compactMode?: boolean;
  queryEditorId: string;
  queryState?: string;
  runQuery: () => void;
  stopQuery: () => void;
  overlayCreateAsMenu: ReactElement | null;
}

const buildTextAndIcon = (
  shouldShowStopButton: boolean,
  selectedText: string | undefined,
  theme: SupersetTheme,
): { text: string; icon?: IconType } => {
  let text = t('Run');
  let icon: IconType | undefined = <Icons.CaretRightOutlined />;
  if (selectedText) {
    text = t('Run selection');
    icon = <Icons.StepForwardOutlined />;
  }
  if (shouldShowStopButton) {
    text = t('Stop');
    icon = <Icons.Square iconColor={theme.colorIcon} />;
  }
  return {
    text,
    icon,
  };
};

const onClick = (
  isStopAction: boolean,
  runQuery: () => void = () => undefined,
  stopQuery = () => {},
  logAction: (name: string, payload: Record<string, any>) => void,
): void => {
  const eventName = isStopAction
    ? LOG_ACTIONS_SQLLAB_STOP_QUERY
    : LOG_ACTIONS_SQLLAB_RUN_QUERY;

  logAction(eventName, { shortcut: false });
  if (isStopAction) return stopQuery();
  runQuery();
};

const StyledButton = styled.span<{ compact?: boolean }>`
  button {
    line-height: 13px;
    min-width: auto !important;
    padding: 0 ${({ theme }) => theme.sizeUnit * 3}px 0
      ${({ theme }) => theme.sizeUnit * 2}px;

    span[name='caret-down'] {
      display: flex;
      margin-left: ${({ theme }) => theme.sizeUnit * 1}px;
    }
  }
`;

const RunQueryActionButton = ({
  queryEditorId,
  queryState,
  overlayCreateAsMenu,
  runQuery,
  stopQuery,
}: RunQueryActionButtonProps) => {
  const theme = useTheme();
  const logAction = useLogAction({ queryEditorId });
  const userOS = detectOS();

  const { selectedText, sql } = useQueryEditor(queryEditorId, [
    'selectedText',
    'sql',
  ]);

  const shouldShowStopBtn =
    !!queryState && ['running', 'pending'].indexOf(queryState) > -1;

  const ButtonComponent: FC<QueryButtonProps> = overlayCreateAsMenu
    ? (DropdownButton as FC)
    : Button;

  const sqlContent = selectedText || sql || '';
  const isDisabled = !sqlContent
    ?.replace(/(\/\*[^*]*\*\/)|(\/\/[^*]*)|(--[^.].*)/gm, '')
    .trim();

  const stopButtonTooltipText = useMemo(
    () =>
      userOS === 'MacOS'
        ? t('Stop running (Ctrl + x)')
        : t('Stop running (Ctrl + e)'),
    [userOS],
  );

  const { text, icon } = useMemo(
    () => buildTextAndIcon(shouldShowStopBtn, selectedText, theme),
    [shouldShowStopBtn, selectedText, theme],
  );

  return (
    <StyledButton>
      <ButtonComponent
        data-test="run-query-action"
        onClick={() =>
          onClick(shouldShowStopBtn, runQuery, stopQuery, logAction)
        }
        disabled={isDisabled}
        tooltip={
          (!isDisabled &&
            (shouldShowStopBtn
              ? stopButtonTooltipText
              : t('Run query (Ctrl + Return)'))) as string
        }
        cta
        {...(overlayCreateAsMenu
          ? {
              overlay: overlayCreateAsMenu,
              icon: (
                <Icons.DownOutlined
                  iconColor={
                    isDisabled ? theme.colorTextDisabled : theme.colorIcon
                  }
                />
              ),
              type: 'primary',
              danger: shouldShowStopBtn,
              trigger: 'click',
            }
          : {
              buttonStyle: shouldShowStopBtn ? 'danger' : 'primary',
              icon,
            })}
      >
        {overlayCreateAsMenu && <>{icon}</>}
        {text}
      </ButtonComponent>
    </StyledButton>
  );
};

export default RunQueryActionButton;
