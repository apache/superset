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
import { t, styled, supersetTheme } from '@superset-ui/core';

import { Menu } from 'src/common/components';
import Button, { ButtonProps } from 'src/components/Button';
import Icons from 'src/components/Icons';
import {
  DropdownButton,
  DropdownButtonProps,
} from 'src/components/DropdownButton';

interface Props {
  allowAsync: boolean;
  queryState?: string;
  runQuery: (c?: boolean) => void;
  selectedText?: string;
  stopQuery: () => void;
  sql: string;
  overlayCreateAsMenu: typeof Menu | null;
}

type QueryButtonProps = DropdownButtonProps | ButtonProps;

const buildText = (
  shouldShowStopButton: boolean,
  selectedText: string | undefined,
): string | JSX.Element => {
  if (shouldShowStopButton) {
    return (
      <>
        <i className="fa fa-stop" /> {t('Stop')}
      </>
    );
  }
  if (selectedText) {
    return t('Run selection');
  }
  return t('Run');
};

const onClick = (
  shouldShowStopButton: boolean,
  allowAsync: boolean,
  runQuery: (c?: boolean) => void = () => undefined,
  stopQuery = () => {},
): void => {
  if (shouldShowStopButton) return stopQuery();
  if (allowAsync) {
    return runQuery(true);
  }
  return runQuery(false);
};

const StyledButton = styled.span`
  button {
    line-height: 13px;
    // this is to over ride a previous transition built into the component
    transition: background-color 0ms;
    &:last-of-type {
      margin-right: ${({ theme }) => theme.gridUnit * 2}px;
    }
    span[name='caret-down'] {
      display: flex;
      margin-right: ${({ theme }) => theme.gridUnit * -2}px;
    }
  }
`;

const RunQueryActionButton = ({
  allowAsync = false,
  queryState,
  selectedText,
  sql = '',
  overlayCreateAsMenu,
  runQuery,
  stopQuery,
}: Props) => {
  const shouldShowStopBtn =
    !!queryState && ['running', 'pending'].indexOf(queryState) > -1;

  const ButtonComponent: React.FC<QueryButtonProps> = overlayCreateAsMenu
    ? (DropdownButton as React.FC)
    : Button;

  const isDisabled = !sql.trim();

  return (
    <StyledButton>
      <ButtonComponent
        onClick={() =>
          onClick(shouldShowStopBtn, allowAsync, runQuery, stopQuery)
        }
        disabled={isDisabled}
        tooltip={
          (!isDisabled &&
            (shouldShowStopBtn
              ? t('Stop running (Ctrl + x)')
              : t('Run query (Ctrl + Return)'))) as string
        }
        cta
        {...(overlayCreateAsMenu
          ? {
              overlay: overlayCreateAsMenu,
              icon: (
                <Icons.CaretDown
                  iconColor={
                    isDisabled
                      ? supersetTheme.colors.grayscale.base
                      : supersetTheme.colors.grayscale.light5
                  }
                  name="caret-down"
                />
              ),
              trigger: 'click',
            }
          : { buttonStyle: 'primary' })}
      >
        {buildText(shouldShowStopBtn, selectedText)}
      </ButtonComponent>
    </StyledButton>
  );
};

export default RunQueryActionButton;
