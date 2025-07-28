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
import { FormItem } from '@superset-ui/core/components';
import { css, styled, SupersetTheme } from '@superset-ui/core';

const MODAL_BODY_HEIGHT = 180.5;

export const StyledFormItem = styled(FormItem)`
  ${({ theme }) => css`
    flex: 1;
    margin-top: 0;
    margin-bottom: ${theme.sizeUnit * 2.5}px;
  }
  `}
`;

export const StyledSwitchContainer = styled.div`
  display: flex;
  align-items: center;
  margin-top: 0;
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
    color: ${theme.colorTextSecondary};
    margin-left: ${theme.sizeUnit * 4}px;
  }
`;

export const antDModalStyles = (theme: SupersetTheme) => css`
  .ant-modal-header {
    padding: ${theme.sizeUnit * 4.5}px ${theme.sizeUnit * 4}px
      ${theme.sizeUnit * 4}px;
  }

  .ant-modal-close-x .close {
    opacity: 1;
  }

  .ant-modal-body {
    height: ${theme.sizeUnit * MODAL_BODY_HEIGHT}px;
  }

  .ant-modal-footer {
    height: ${theme.sizeUnit * 16.25}px;
  }

  .info-solid-small {
    vertical-align: bottom;
  }
`;
