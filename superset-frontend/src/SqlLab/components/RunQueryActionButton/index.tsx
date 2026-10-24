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
import {
  useMemo,
  FC,
  ReactElement,
  type SyntheticEvent,
  type ReactNode,
} from 'react';

import { t } from '@apache-superset/core/translation';
import { styled, useTheme, SupersetTheme } from '@apache-superset/core/theme';

import { Button, DropdownButton } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { detectOS } from 'src/utils/common';
import { QueryButtonProps } from 'src/SqlLab/types';
import useQueryEditor from 'src/SqlLab/hooks/useQueryEditor';
import useRunStopButton from 'src/hooks/useRunStopButton';
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
  runTooltipText?: string;
  overlayCreateAsMenu: ReactElement | null;
  checkingCost?: boolean;
  cancelCostCheck?: () => void;
  awaitingConfirmation?: boolean;
}

const buildTextAndIcon = (
  shouldShowStopButton: boolean,
  selectedText: string | undefined,
  theme: SupersetTheme,
): { text: string; icon?: ReactNode } => {
  let text = t('Run');
  let icon: ReactNode = <Icons.CaretRightOutlined />;
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
  logAction: (name: string, payload: Record<string, unknown>) => void,
): void => {
  const eventName = isStopAction
    ? LOG_ACTIONS_SQLLAB_STOP_QUERY
    : LOG_ACTIONS_SQLLAB_RUN_QUERY;

  logAction(eventName, { shortcut: false });
  if (isStopAction) return stopQuery();
  runQuery();
};

/** Only the main split button changes action; caret gestures open a menu. */
const isMainButtonGesture = (event: SyntheticEvent<HTMLSpanElement>) =>
  event.target instanceof Element &&
  event.target.closest('button') ===
    event.currentTarget.querySelector('button');

const StyledButton = styled.span`
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
  runTooltipText,
  checkingCost = false,
  cancelCostCheck,
  awaitingConfirmation = false,
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
  const {
    onPointerDownCapture,
    onKeyDownCapture,
    onBlurCapture,
    onClick: handleClick,
  } = useRunStopButton(shouldShowStopBtn, () =>
    onClick(shouldShowStopBtn, runQuery, stopQuery, logAction),
  );

  const showMenu =
    overlayCreateAsMenu && !checkingCost && !awaitingConfirmation;
  const ButtonComponent: FC<QueryButtonProps> = showMenu
    ? (DropdownButton as FC)
    : Button;

  const sqlContent = selectedText || sql || '';
  const isDisabled =
    !shouldShowStopBtn &&
    (checkingCost ||
      awaitingConfirmation ||
      !sqlContent
        ?.replace(/(\/\*[^*]*\*\/)|(\/\/[^*]*)|(--[^.].*)/gm, '')
        .trim());

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
    <StyledButton
      onBlurCapture={onBlurCapture}
      onPointerDownCapture={event => {
        if (isMainButtonGesture(event)) onPointerDownCapture(event);
      }}
      onKeyDownCapture={event => {
        if (isMainButtonGesture(event)) onKeyDownCapture(event);
      }}
    >
      <ButtonComponent
        data-test="run-query-action"
        onClick={handleClick}
        disabled={isDisabled}
        tooltip={
          (!isDisabled &&
            (shouldShowStopBtn
              ? stopButtonTooltipText
              : (runTooltipText ?? t('Run query (Ctrl + Return)')))) as string
        }
        cta
        {...(showMenu
          ? {
              popupRender: () => overlayCreateAsMenu,
              icon: (
                <Icons.DownOutlined
                  iconColor={
                    isDisabled
                      ? theme.colorTextDisabled
                      : theme.colorTextLightSolid
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
        {showMenu && <>{icon}</>}
        {checkingCost && !shouldShowStopBtn ? t('Checking cost…') : text}
      </ButtonComponent>
      {checkingCost && (
        <Button
          buttonStyle="secondary"
          onClick={cancelCostCheck}
          tooltip={t('Cancel cost check')}
        >
          {t('Cancel')}
        </Button>
      )}
    </StyledButton>
  );
};

export default RunQueryActionButton;
