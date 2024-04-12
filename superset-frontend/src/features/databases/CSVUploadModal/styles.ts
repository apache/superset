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
import { FormItem } from 'src/components/Form';
import { css, styled, SupersetTheme } from '@superset-ui/core';

const MODAL_BODY_HEIGHT = 180.5;
const antIconHeight = 12;

export const StyledFormItem = styled(FormItem)`
  ${({ theme }) => css`
    flex: 1;
    margin-top: 0;
    margin-bottom: ${theme.gridUnit * 2.5}px;
  }
  `}
`;

export const StyledSwitchContainer = styled.div`
  display: flex;
  align-items: center;
  margin-top: 0;
`;

export const antdCollapseStyles = (theme: SupersetTheme) => css`
  .ant-collapse-header {
    padding-top: ${theme.gridUnit * 3.5}px;
    padding-bottom: ${theme.gridUnit * 2.5}px;
    .anticon.ant-collapse-arrow {
      top: calc(50% - ${antIconHeight / 2}px);
    }
    .helper {
      color: ${theme.colors.grayscale.base};
      font-size: ${theme.typography.sizes.s}px;
    }
  }
  h4 {
    font-size: ${theme.typography.sizes.l}px;
    margin-top: 0;
    margin-bottom: ${theme.gridUnit}px;
  }
  p.helper {
    margin-bottom: 0;
    padding: 0;
  }
`;

export const antDModalNoPaddingStyles = css`
  .ant-modal-body {
    padding-left: 0;
    padding-right: 0;
    padding-top: 0;
  }
`;

export const formStyles = (theme: SupersetTheme) => css`
  .switch-label {
    color: ${theme.colors.grayscale.base};
    margin-left: ${theme.gridUnit * 4}px;
  }
`;

export const antDModalStyles = (theme: SupersetTheme) => css`
  .ant-modal-header {
    padding: ${theme.gridUnit * 4.5}px ${theme.gridUnit * 4}px
      ${theme.gridUnit * 4}px;
  }

  .ant-modal-close-x .close {
    color: ${theme.colors.grayscale.dark1};
    opacity: 1;
  }

  .ant-modal-body {
    height: ${theme.gridUnit * MODAL_BODY_HEIGHT}px;
  }

  .ant-modal-footer {
    height: ${theme.gridUnit * 16.25}px;
  }

  .info-solid-small {
    vertical-align: bottom;
  }
`;
