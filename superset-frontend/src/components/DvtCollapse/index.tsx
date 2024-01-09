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
import React, { ReactNode, useState } from 'react';
import { SupersetTheme } from '@superset-ui/core';
import Icon from '../Icons/Icon';
import {
  StyledCollapse,
  StyledCollapsePopover,
  StyledCollapseGroup,
  StyledCollapseLabel,
  StyledCollapseIcon,
  StyledCollapseChildren,
} from './dvt-collapse.module';
import DvtPopper from '../DvtPopper';

export interface DvtCollapseProps {
  label: string;
  children: ReactNode;
  popoverIcon?: boolean;
  popoverLabel?: string;
  popoverDirection?: 'top' | 'bottom' | 'left' | 'right';
}

const DvtCollapse: React.FC<DvtCollapseProps> = ({
  label,
  children,
  popoverIcon = 'warning',
  popoverDirection = 'top',
  popoverLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <StyledCollapse>
      <StyledCollapseGroup>
        <StyledCollapseLabel>
          {label}
          {popoverLabel && popoverIcon && (
            <StyledCollapsePopover>
              <DvtPopper label={popoverLabel} direction={popoverDirection}>
                <Icon
                  fileName="warning"
                  css={(theme: SupersetTheme) => ({
                    color: theme.colors.dvt.primary.base,
                  })}
                  iconSize="l"
                />
              </DvtPopper>
            </StyledCollapsePopover>
          )}
        </StyledCollapseLabel>
        <StyledCollapseIcon isOpen={isOpen}>
          <Icon
            fileName="caret_down"
            iconSize="xxl"
            onClick={() => setIsOpen(!isOpen)}
          />
        </StyledCollapseIcon>
      </StyledCollapseGroup>

      {isOpen && <StyledCollapseChildren>{children}</StyledCollapseChildren>}
    </StyledCollapse>
  );
};

export default DvtCollapse;
