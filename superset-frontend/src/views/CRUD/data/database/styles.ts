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
import Modal from 'src/components/Modal';
import { JsonEditor } from 'src/components/AsyncAceEditor';
import Tabs from 'src/common/components/Tabs';

const CTAS_CVAS_SCHEMA_FORM_HEIGHT = 102;
const EXPOSE_IN_SQLLAB_FORM_HEIGHT = CTAS_CVAS_SCHEMA_FORM_HEIGHT + 52;
const EXPOSE_ALL_FORM_HEIGHT = EXPOSE_IN_SQLLAB_FORM_HEIGHT + 102;

const anticonHeight = 12;

export const StyledModal = styled(Modal)`
  .ant-collapse {
    .ant-collapse-header {
      padding-top: ${({ theme }) => theme.gridUnit * 3.5}px;
      padding-bottom: ${({ theme }) => theme.gridUnit * 2.5}px;

      .anticon.ant-collapse-arrow {
        top: calc(50% - ${anticonHeight / 2}px);
      }
      .helper {
        color: ${({ theme }) => theme.colors.grayscale.base};
      }
    }
    h4 {
      font-size: 16px;
      font-weight: bold;
      margin-top: 0;
      margin-bottom: ${({ theme }) => theme.gridUnit}px;
    }
    p.helper {
      margin-bottom: 0;
      padding: 0;
    }
  }
  .ant-modal-header {
    padding: 18px 16px 16px;
  }
  .ant-modal-body {
    padding-left: 0;
    padding-right: 0;
  }
  .ant-tabs-top > .ant-tabs-nav {
    margin-bottom: 0;
  }
  .ant-modal-close-x .close {
    color: ${({ theme }) => theme.colors.grayscale.dark1};
    opacity: 1;
  }

  .required {
    margin-left: ${({ theme }) => theme.gridUnit / 2}px;
    color: ${({ theme }) => theme.colors.error.base};
  }

  .helper {
    display: block;
    padding: ${({ theme }) => theme.gridUnit}px 0;
    color: ${({ theme }) => theme.colors.grayscale.light1};
    font-size: ${({ theme }) => theme.typography.sizes.s - 1}px;
    text-align: left;
  }
  .ant-modal-title > h4 {
    font-weight: bold;
  }
`;

export const StyledInputContainer = styled.div`
  margin-bottom: ${({ theme }) => theme.gridUnit * 6}px;
  &.mb-0 {
    margin-bottom: 0;
  }
  &.mb-8 {
    margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;
  }

  .control-label {
    color: ${({ theme }) => theme.colors.grayscale.dark1};
    font-size: ${({ theme }) => theme.typography.sizes.s - 1}px;
    margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;
  }

  &.extra-container {
    padding-top: 8px;
  }

  .input-container {
    display: flex;
    align-items: top;

    label {
      display: flex;
      margin-left: ${({ theme }) => theme.gridUnit * 2}px;
      margin-top: ${({ theme }) => theme.gridUnit * 0.75}px;
      font-family: ${({ theme }) => theme.typography.families.sansSerif};
      font-size: ${({ theme }) => theme.typography.sizes.m}px;
    }

    i {
      margin: 0 ${({ theme }) => theme.gridUnit}px;
    }
  }

  input,
  textarea {
    flex: 1 1 auto;
  }

  textarea {
    height: 160px;
    resize: none;
  }

  input::placeholder,
  textarea::placeholder {
    color: ${({ theme }) => theme.colors.grayscale.light1};
  }

  textarea,
  input[type='text'],
  input[type='number'] {
    padding: ${({ theme }) => theme.gridUnit * 1.5}px
      ${({ theme }) => theme.gridUnit * 2}px;
    border-style: none;
    border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
    border-radius: ${({ theme }) => theme.gridUnit}px;

    &[name='name'] {
      flex: 0 1 auto;
      width: 40%;
    }

    &[name='sqlalchemy_uri'] {
      margin-right: ${({ theme }) => theme.gridUnit * 3}px;
    }
  }
  &.expandable {
    height: 0;
    overflow: hidden;
    transition: height 0.25s;
    margin-left: ${({ theme }) => theme.gridUnit * 8}px;
    margin-bottom: 0;
    padding: 0;
    .control-label {
      margin-bottom: 0;
    }
    &.open {
      height: ${CTAS_CVAS_SCHEMA_FORM_HEIGHT}px;
      padding-right: ${({ theme }) => theme.gridUnit * 5}px;
    }
  }
`;

export const StyledJsonEditor = styled(JsonEditor)`
  flex: 1 1 auto;
  border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  border-radius: ${({ theme }) => theme.gridUnit}px;
`;

export const StyledExpandableForm = styled.div`
  padding-top: ${({ theme }) => theme.gridUnit}px;
  .input-container {
    padding-top: ${({ theme }) => theme.gridUnit}px;
    padding-bottom: ${({ theme }) => theme.gridUnit}px;
  }
  &.expandable {
    height: 0;
    overflow: hidden;
    transition: height 0.25s;
    margin-left: ${({ theme }) => theme.gridUnit * 7}px;
    &.open {
      height: ${EXPOSE_IN_SQLLAB_FORM_HEIGHT}px;
      &.ctas-open {
        height: ${EXPOSE_ALL_FORM_HEIGHT}px;
      }
    }
  }
`;

export const StyledRequiredTab = styled(Tabs.TabPane)`
  padding-left: ${({ theme }) => theme.gridUnit * 4}px;
  padding-right: ${({ theme }) => theme.gridUnit * 4}px;
  margin-top: ${({ theme }) => theme.gridUnit * 4}px;
`;
