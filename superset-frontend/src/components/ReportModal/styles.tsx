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

import { styled, css, SupersetTheme } from '@superset-ui/core';
import Modal from 'src/components/Modal';
import Button from 'src/components/Button';

export const StyledModal = styled(Modal)`
  .ant-modal-body {
    padding: 0;
  }
`;

export const StyledTopSection = styled.div`
  padding: ${({ theme }) => theme.gridUnit * 4}px;
`;

export const StyledBottomSection = styled.div`
  border-top: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  padding: ${({ theme }) => theme.gridUnit * 4}px;
`;

export const StyledIconWrapper = styled.span`
  span {
    margin-right: ${({ theme }) => theme.gridUnit * 2}px;
    vertical-align: middle;
  }
  .text {
    vertical-align: middle;
  }
`;

export const StyledScheduleTitle = styled.div`
  margin-bottom: ${({ theme }) => theme.gridUnit * 7}px;
`;

export const StyledCronError = styled.p`
  color: ${({ theme }) => theme.colors.error.base};
`;

export const noBottomMargin = css`
  margin-bottom: 0;
`;

export const StyledFooterButton = styled(Button)`
  width: ${({ theme }) => theme.gridUnit * 40}px;
`;

export const timezoneHeaderStyle = (theme: SupersetTheme) => css`
  margin: ${theme.gridUnit * 3}px 0;
`;
