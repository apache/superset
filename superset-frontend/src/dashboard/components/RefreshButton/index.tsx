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
import { FC, useState, useCallback } from 'react';
import { css, useTheme, t } from '@apache-superset/core/ui';
import { Tooltip } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';

export interface RefreshButtonProps {
  onRefresh: () => Promise<void> | void;
}

export const RefreshButton: FC<RefreshButtonProps> = ({ onRefresh }) => {
  const theme = useTheme();
  const [isSpinning, setIsSpinning] = useState(false);

  const buttonStyles = css`
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    color: ${theme.colorTextSecondary};
    transition: color ${theme.motionDurationMid};
    margin-left: ${theme.marginXS}px;
    margin-right: ${theme.marginSM}px;

    &:hover {
      color: ${theme.colorText};
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
  `;

  const handleClick = useCallback(() => {
    if (isSpinning) {
      return;
    }
    setIsSpinning(true);
    Promise.resolve(onRefresh()).finally(() => {
      setIsSpinning(false);
    });
  }, [isSpinning, onRefresh]);

  return (
    <Tooltip title={t('Refresh dashboard')} placement="bottom">
      <button
        type="button"
        css={buttonStyles}
        onClick={handleClick}
        aria-label={t('Refresh dashboard')}
        data-test="refresh-button"
        disabled={isSpinning}
      >
        <Icons.SyncOutlined iconSize="l" spin={isSpinning} />
      </button>
    </Tooltip>
  );
};

export default RefreshButton;
