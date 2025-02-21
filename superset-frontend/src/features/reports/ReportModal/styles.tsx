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
import { Radio } from 'src/components/Radio';
import { CronPicker } from 'src/components/CronPicker';

export const StyledModal = styled(Modal)`
  .antd5-modal-body {
    padding: 0;
  }
`;

export const StyledTopSection = styled.div`
  padding: ${({ theme }) =>
    `${theme.gridUnit * 3}px ${theme.gridUnit * 4}px ${theme.gridUnit * 2}px`};
  label {
    font-size: ${({ theme }) => theme.typography.sizes.s}px;
    color: ${({ theme }) => theme.colors.grayscale.light1};
  }
`;

export const StyledBottomSection = styled.div`
  border-top: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  padding: ${({ theme }) =>
    `${theme.gridUnit * 4}px ${theme.gridUnit * 4}px ${theme.gridUnit * 6}px`};
  .ant-select {
    width: 100%;
  }
  .control-label {
    font-size: ${({ theme }) => theme.typography.sizes.s}px;
    color: ${({ theme }) => theme.colors.grayscale.light1};
  }
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

  h4 {
    margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
  }
`;

export const StyledCronPicker = styled(CronPicker)`
  margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
  width: ${({ theme }) => theme.gridUnit * 120}px;
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

export const TimezoneHeaderStyle = (theme: SupersetTheme) => css`
  margin: ${theme.gridUnit * 3}px 0 ${theme.gridUnit * 2}px;
`;

export const CustomWidthHeaderStyle = (theme: SupersetTheme) => css`
  margin: ${theme.gridUnit * 3}px 0 ${theme.gridUnit * 2}px;
`;

export const SectionHeaderStyle = (theme: SupersetTheme) => css`
  margin: ${theme.gridUnit * 3}px 0;
`;

export const StyledMessageContentTitle = styled.div`
  margin: ${({ theme }) => theme.gridUnit * 8}px 0
    ${({ theme }) => theme.gridUnit * 4}px;
`;

export const StyledRadio = styled(Radio)`
  display: block;
  line-height: ${({ theme }) => theme.gridUnit * 8}px;
`;

export const antDErrorAlertStyles = (theme: SupersetTheme) => css`
  margin: ${theme.gridUnit * 4}px;
  margin-top: 0;
`;
