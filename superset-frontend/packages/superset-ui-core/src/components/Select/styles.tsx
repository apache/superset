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
import { styled } from '@superset-ui/core';
import { Select } from 'antd';
import { Icons } from '@superset-ui/core/components/Icons';
import { Spin } from '../Spin';
import { Flex } from '../Flex';

export const StyledHeader = styled.span<{ headerPosition: string }>`
  ${({ theme, headerPosition }) => `
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-right: ${headerPosition === 'left' ? theme.sizeUnit * 2 : 0}px;
    font-size: ${theme.fontSizeSM}px;
  `}
`;

export const StyledContainer = styled.div<{ headerPosition: string }>`
  ${({ headerPosition, theme }) => `
    display: flex;
    gap: ${theme.sizeUnit}px;
    flex-direction: ${headerPosition === 'top' ? 'column' : 'row'};
    align-items: ${headerPosition === 'left' ? 'center' : undefined};
    width: 100%;
  `}
`;

export const StyledSelect = styled(Select, {
  shouldForwardProp: prop => prop !== 'headerPosition' && prop !== 'oneLine',
})<{ headerPosition?: string; oneLine?: boolean }>`
  ${({ theme, headerPosition, oneLine }) => `
    .ant-select-item-option-active:not(.ant-select-item-option-disabled) {
      outline: 2px solid ${theme.colorPrimary};
      outline-offset: -2px;
    }
    flex: ${headerPosition === 'left' ? 1 : 0};
    line-height: ${theme.sizeXL}px;

    && .ant-select-selection-search {
      left: 0px;
    }

    && .ant-select-selection-item, .ant-select-selection-placeholder {
      max-height: ${theme.sizeXL}px;
    }
    .ant-select-selection-item::after {
      height: 0;
      display: block !important;
    }
    ${
      oneLine &&
      `
        .ant-select-selection-overflow {
          flex-wrap: nowrap;
        }

        .ant-select-selection-overflow-item:not(.ant-select-selection-overflow-item-rest):not(.ant-select-selection-overflow-item-suffix) {
          flex-shrink: 1;
          min-width: ${theme.sizeUnit * 13}px;
        }

        .ant-select-selection-overflow-item-suffix {
          flex: unset;
          min-width: 0px;
        }
      `
    };
 `}
`;

export const NoElement = styled.span`
  display: none;
`;

export const StyledStopOutlined = styled(Icons.StopOutlined)`
  vertical-align: 0;
`;

export const StyledCheckOutlined = styled(Icons.CheckOutlined)`
  vertical-align: 0;
`;

export const StyledSpin = styled(Spin)`
  margin-top: ${({ theme }) => -theme.sizeUnit}px;
`;

export const StyledLoadingText = styled.div`
  ${({ theme }) => `
   margin-left: ${theme.sizeUnit * 3}px;
   line-height: ${theme.sizeUnit * 8}px;
   color: ${theme.colorTextSecondary};
 `}
`;

export const StyledHelperText = styled.div`
  ${({ theme }) => `
   padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
   color: ${theme.colorText};
   font-size: ${theme.fontSizeSM}px;
   cursor: default;
   border-bottom: 1px solid ${theme.colorBorderSecondary};
 `}
`;

export const StyledError = styled.div`
  ${({ theme }) => `
    display: flex;
    justify-content: center;
    align-items: flex-start;
    width: 100%;
    padding: ${theme.sizeUnit * 2}px;
    color: ${theme.colorError};
    & svg {
      margin-right: ${theme.sizeUnit * 2}px;
    }
  `}
`;

export const StyledErrorMessage = styled.div`
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const StyledBulkActionsContainer = styled(Flex)`
  ${({ theme }) => `
    padding: ${theme.sizeUnit}px;
    border-top: 1px solid ${theme.colorSplit};
  `}
`;
