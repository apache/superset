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
import { ReactElement } from 'react';
import { styled } from '@superset-ui/core';
import { Tooltip } from 'src/components/Tooltip';
import Icons from 'src/components/Icons';
import { TooltipPlacement } from 'antd/lib/tooltip';

export type ActionProps = {
  label: string;
  tooltip?: string | ReactElement;
  placement?: TooltipPlacement;
  icon: string;
  onClick: () => void;
};

interface ActionsBarProps {
  actions: Array<ActionProps>;
}

const StyledActions = styled.span`
  white-space: nowrap;
  min-width: 100px;
  svg,
  i {
    margin-right: 8px;

    &:hover {
      path {
        fill: ${({ theme }) => theme.colors.primary.base};
      }
    }
  }
`;

const ActionWrapper = styled.span`
  color: ${({ theme }) => theme.colors.grayscale.base};
`;

export default function ActionsBar({ actions }: ActionsBarProps) {
  return (
    <StyledActions className="actions">
      {actions.map((action, index) => {
        const ActionIcon = Icons[action.icon];
        if (action.tooltip) {
          return (
            <Tooltip
              id={`${action.label}-tooltip`}
              title={action.tooltip}
              placement={action.placement}
              key={index}
            >
              <ActionWrapper
                role="button"
                tabIndex={0}
                className="action-button"
                data-test={action.label}
                onClick={action.onClick}
              >
                <ActionIcon />
              </ActionWrapper>
            </Tooltip>
          );
        }

        return (
          <ActionWrapper
            role="button"
            tabIndex={0}
            className="action-button"
            onClick={action.onClick}
            data-test={action.label}
            key={index}
          >
            <ActionIcon />
          </ActionWrapper>
        );
      })}
    </StyledActions>
  );
}
