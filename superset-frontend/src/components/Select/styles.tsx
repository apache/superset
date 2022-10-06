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
import Icons from 'src/components/Icons';
import { Spin } from 'antd';
import AntdSelect from 'antd/lib/select';

export const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
`;

export const StyledSelect = styled(AntdSelect)`
  ${({ theme }) => `
   && .ant-select-selector {
     border-radius: ${theme.gridUnit}px;
   }
   // Open the dropdown when clicking on the suffix
   // This is fixed in version 4.16
   .ant-select-arrow .anticon:not(.ant-select-suffix) {
     pointer-events: none;
   }
 `}
`;

export const StyledStopOutlined = styled(Icons.StopOutlined)`
  vertical-align: 0;
`;

export const StyledCheckOutlined = styled(Icons.CheckOutlined)`
  vertical-align: 0;
`;

export const StyledSpin = styled(Spin)`
  margin-top: ${({ theme }) => -theme.gridUnit}px;
`;

export const StyledLoadingText = styled.div`
  ${({ theme }) => `
   margin-left: ${theme.gridUnit * 3}px;
   line-height: ${theme.gridUnit * 8}px;
   color: ${theme.colors.grayscale.light1};
 `}
`;

export const StyledHelperText = styled.div`
  ${({ theme }) => `
   padding: ${theme.gridUnit * 2}px ${theme.gridUnit * 3}px;
   color: ${theme.colors.grayscale.base};
   font-size: ${theme.typography.sizes.s}px;
   cursor: default;
   border-bottom: 1px solid ${theme.colors.grayscale.light2};
 `}
`;

export const StyledError = styled.div`
  ${({ theme }) => `
    display: flex;
    justify-content: center;
    align-items: flex-start;
    width: 100%;
    padding: ${theme.gridUnit * 2}px;
    color: ${theme.colors.error.base};
    & svg {
      margin-right: ${theme.gridUnit * 2}px;
    }
  `}
`;

export const StyledErrorMessage = styled.div`
  overflow: hidden;
  text-overflow: ellipsis;
`;
