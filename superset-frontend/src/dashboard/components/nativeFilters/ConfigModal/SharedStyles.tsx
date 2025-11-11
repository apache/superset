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
import { styled, css } from '@apache-superset/core/ui';
import { Form, StyledModal } from '@superset-ui/core/components';

const MODAL_MARGIN = 16;
const MIN_WIDTH = 880;

export interface BaseModalWrapperProps {
  expanded: boolean;
}

export interface BaseModalBodyProps {
  expanded: boolean;
}

export const BaseModalWrapper = styled(StyledModal)<BaseModalWrapperProps>`
  min-width: ${MIN_WIDTH}px;
  width: ${({ expanded }) => (expanded ? '100%' : MIN_WIDTH)} !important;

  @media (max-width: ${MIN_WIDTH + MODAL_MARGIN * 2}px) {
    width: 100% !important;
    min-width: auto;
  }

  .ant-modal-body {
    padding: 0px;
    overflow: auto;
  }

  ${({ expanded }) =>
    expanded &&
    css`
      height: 100%;

      .ant-modal-body {
        flex: 1 1 auto;
      }
      .ant-modal-content {
        height: 100%;
      }
    `}
`;

export const BaseModalBody = styled.div<BaseModalBodyProps>`
  display: flex;
  height: ${({ expanded }) => (expanded ? '100%' : '700px')};
  flex-direction: row;
  flex: 1;

  .filters-list {
    display: flex;
    flex-direction: column;
  }
`;

export const BaseForm = styled(Form)`
  width: 100%;
`;

export const BaseExpandButtonWrapper = styled.div`
  margin-left: ${({ theme }) => theme.sizeUnit * 4}px;
`;

export const BaseFormItem = styled(Form.Item)<{ expanded?: boolean }>`
  width: ${({ expanded }) => (expanded ? '49%' : '260px')};
`;

export const BaseRowFormItem = styled(Form.Item)<{ expanded?: boolean }>`
  min-width: ${({ expanded }) => (expanded ? '50%' : '260px')};
`;

export const BaseRowSubFormItem = styled(Form.Item)<{ expanded?: boolean }>`
  min-width: ${({ expanded }) => (expanded ? '50%' : '260px')};
`;

export const BaseLabel = styled.span`
  ${({ theme }) => `
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextSecondary};
  `}
`;

export const BaseAsterisk = styled.span`
  ${({ theme }) => `
    color: ${theme.colorError};
    font-size: ${theme.fontSizeSM}px;
    margin-left: ${theme.sizeUnit - 1}px;

    &:before {
      content: '*';
    }
  `}
`;
