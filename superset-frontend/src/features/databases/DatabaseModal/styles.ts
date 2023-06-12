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

import { css, styled, SupersetTheme } from '@superset-ui/core';
import { JsonEditor } from 'src/components/AsyncAceEditor';
import Button from 'src/components/Button';

const CTAS_CVAS_SCHEMA_FORM_HEIGHT = 108;
const EXPOSE_IN_SQLLAB_FORM_HEIGHT = CTAS_CVAS_SCHEMA_FORM_HEIGHT + 153;
const EXPOSE_ALL_FORM_HEIGHT = EXPOSE_IN_SQLLAB_FORM_HEIGHT + 102;
const MODAL_BODY_HEIGHT = 180.5;

const anticonHeight = 12;

export const no_margin_bottom = css`
  margin-bottom: 0;
`;

export const labelMarginBottom = (theme: SupersetTheme) => css`
  margin-bottom: ${theme.gridUnit * 2}px;
`;

export const marginBottom = (theme: SupersetTheme) => css`
  margin-bottom: ${theme.gridUnit * 4}px;
`;

export const StyledFormHeader = styled.header`
  padding: ${({ theme }) => theme.gridUnit * 2}px
    ${({ theme }) => theme.gridUnit * 4}px;
  line-height: ${({ theme }) => theme.gridUnit * 6}px;

  .helper-top {
    padding-bottom: 0;
    color: ${({ theme }) => theme.colors.grayscale.base};
    font-size: ${({ theme }) => theme.typography.sizes.s}px;
    margin: 0;
  }

  .subheader-text {
    line-height: ${({ theme }) => theme.gridUnit * 4.25}px;
  }

  .helper-bottom {
    padding-top: 0;
    color: ${({ theme }) => theme.colors.grayscale.base};
    font-size: ${({ theme }) => theme.typography.sizes.s}px;
    margin: 0;
  }

  h4 {
    color: ${({ theme }) => theme.colors.grayscale.dark2};
    font-size: ${({ theme }) => theme.typography.sizes.l}px;
    margin: 0;
    padding: 0;
    line-height: ${({ theme }) => theme.gridUnit * 8}px;
  }

  .select-db {
    padding-bottom: ${({ theme }) => theme.gridUnit * 2}px;
    .helper {
      margin: 0;
    }

    h4 {
      margin: 0 0 ${({ theme }) => theme.gridUnit * 4}px;
    }
  }
`;

export const antdCollapseStyles = (theme: SupersetTheme) => css`
  .ant-collapse-header {
    padding-top: ${theme.gridUnit * 3.5}px;
    padding-bottom: ${theme.gridUnit * 2.5}px;

    .anticon.ant-collapse-arrow {
      top: calc(50% - ${anticonHeight / 2}px);
    }
    .helper {
      color: ${theme.colors.grayscale.base};
    }
  }
  h4 {
    font-size: 16px;
    margin-top: 0;
    margin-bottom: ${theme.gridUnit}px;
  }
  p.helper {
    margin-bottom: 0;
    padding: 0;
  }
`;

export const antDTabsStyles = css`
  .ant-tabs-top {
    margin-top: 0;
  }
  .ant-tabs-top > .ant-tabs-nav {
    margin-bottom: 0;
  }
  .ant-tabs-tab {
    margin-right: 0;
  }
`;

export const antDModalNoPaddingStyles = css`
  .ant-modal-body {
    padding-left: 0;
    padding-right: 0;
    padding-top: 0;
  }
`;

export const infoTooltip = (theme: SupersetTheme) => css`
  margin-bottom: ${theme.gridUnit * 5}px;
  svg {
    margin-bottom: ${theme.gridUnit * 0.25}px;
  }
`;

export const toggleStyle = (theme: SupersetTheme) => css`
  padding-left: ${theme.gridUnit * 2}px;
`;

export const formScrollableStyles = (theme: SupersetTheme) => css`
  padding: ${theme.gridUnit * 4}px ${theme.gridUnit * 4}px 0;
`;

export const antDModalStyles = (theme: SupersetTheme) => css`
  .ant-select-dropdown {
    height: ${theme.gridUnit * 40}px;
  }

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
`;

export const antDAlertStyles = (theme: SupersetTheme) => css`
  border: 1px solid ${theme.colors.info.base};
  padding: ${theme.gridUnit * 4}px;
  margin: ${theme.gridUnit * 4}px 0;

  .ant-alert-message {
    color: ${theme.colors.info.dark2};
    font-size: ${theme.typography.sizes.m}px;
    font-weight: ${theme.typography.weights.bold};
  }

  .ant-alert-description {
    color: ${theme.colors.info.dark2};
    font-size: ${theme.typography.sizes.m}px;
    line-height: ${theme.gridUnit * 5}px;

    a {
      text-decoration: underline;
    }

    .ant-alert-icon {
      margin-right: ${theme.gridUnit * 2.5}px;
      font-size: ${theme.typography.sizes.l}px;
      position: relative;
      top: ${theme.gridUnit / 4}px;
    }
  }
`;

export const StyledAlertMargin = styled.div`
  ${({ theme }) => css`
    margin: 0 ${theme.gridUnit * 4}px -${theme.gridUnit * 4}px;
  `}
`;

export const antDErrorAlertStyles = (theme: SupersetTheme) => css`
  border: ${theme.colors.error.base} 1px solid;
  padding: ${theme.gridUnit * 4}px;
  margin: ${theme.gridUnit * 8}px ${theme.gridUnit * 4}px;
  color: ${theme.colors.error.dark2};
  .ant-alert-message {
    font-size: ${theme.typography.sizes.m}px;
    font-weight: ${theme.typography.weights.bold};
  }
  .ant-alert-description {
    font-size: ${theme.typography.sizes.m}px;
    line-height: ${theme.gridUnit * 5}px;
    .ant-alert-icon {
      margin-right: ${theme.gridUnit * 2.5}px;
      font-size: ${theme.typography.sizes.l}px;
      position: relative;
      top: ${theme.gridUnit / 4}px;
    }
  }
`;

export const antdWarningAlertStyles = (theme: SupersetTheme) => css`
  border: 1px solid ${theme.colors.warning.light1};
  padding: ${theme.gridUnit * 4}px;
  margin: ${theme.gridUnit * 4}px 0;
  color: ${theme.colors.warning.dark2};

  .ant-alert-message {
    margin: 0;
  }

  .ant-alert-description {
    font-size: ${theme.typography.sizes.s + 1}px;
    line-height: ${theme.gridUnit * 4}px;

    .ant-alert-icon {
      margin-right: ${theme.gridUnit * 2.5}px;
      font-size: ${theme.typography.sizes.l + 1}px;
      position: relative;
      top: ${theme.gridUnit / 4}px;
    }
  }
`;

export const formHelperStyles = (theme: SupersetTheme) => css`
  .required {
    margin-left: ${theme.gridUnit / 2}px;
    color: ${theme.colors.error.base};
  }

  .helper {
    display: block;
    padding: ${theme.gridUnit}px 0;
    color: ${theme.colors.grayscale.light1};
    font-size: ${theme.typography.sizes.s}px;
    text-align: left;
  }
`;

export const wideButton = (theme: SupersetTheme) => css`
  width: 100%;
  border: 1px solid ${theme.colors.primary.dark2};
  color: ${theme.colors.primary.dark2};
  &:hover,
  &:focus {
    border: 1px solid ${theme.colors.primary.dark1};
    color: ${theme.colors.primary.dark1};
  }
`;

export const formStyles = (theme: SupersetTheme) => css`
  .form-group {
    margin-bottom: ${theme.gridUnit * 4}px;
    &-w-50 {
      display: inline-block;
      width: ${`calc(50% - ${theme.gridUnit * 4}px)`};
      & + .form-group-w-50 {
        margin-left: ${theme.gridUnit * 8}px;
      }
    }
  }
  .control-label {
    color: ${theme.colors.grayscale.dark1};
    font-size: ${theme.typography.sizes.s}px;
  }
  .helper {
    color: ${theme.colors.grayscale.light1};
    font-size: ${theme.typography.sizes.s}px;
    margin-top: ${theme.gridUnit * 1.5}px;
  }
  .ant-tabs-content-holder {
    overflow: auto;
    max-height: 480px;
  }
`;

export const validatedFormStyles = (theme: SupersetTheme) => css`
  label {
    color: ${theme.colors.grayscale.dark1};
    font-size: ${theme.typography.sizes.s}px;
    margin-bottom: 0;
  }
`;

export const StyledInputContainer = styled.div`
  ${({ theme }) => css`
    margin-bottom: ${theme.gridUnit * 6}px;
    &.mb-0 {
      margin-bottom: 0;
    }
    &.mb-8 {
      margin-bottom: ${theme.gridUnit * 2}px;
    }

    .control-label {
      color: ${theme.colors.grayscale.dark1};
      font-size: ${theme.typography.sizes.s}px;
      margin-bottom: ${theme.gridUnit * 2}px;
    }

    &.extra-container {
      padding-top: ${theme.gridUnit * 2}px;
    }

    .input-container {
      display: flex;
      align-items: top;

      label {
        display: flex;
        margin-left: ${theme.gridUnit * 2}px;
        margin-top: ${theme.gridUnit * 0.75}px;
        font-family: ${theme.typography.families.sansSerif};
        font-size: ${theme.typography.sizes.m}px;
      }

      i {
        margin: 0 ${theme.gridUnit}px;
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
      color: ${theme.colors.grayscale.light1};
    }

    textarea,
    input[type='text'],
    input[type='number'] {
      padding: ${theme.gridUnit * 1.5}px ${theme.gridUnit * 2}px;
      border-style: none;
      border: 1px solid ${theme.colors.grayscale.light2};
      border-radius: ${theme.gridUnit}px;

      &[name='name'] {
        flex: 0 1 auto;
        width: 40%;
      }
    }
    &.expandable {
      height: 0;
      overflow: hidden;
      transition: height 0.25s;
      margin-left: ${theme.gridUnit * 8}px;
      margin-bottom: 0;
      padding: 0;
      .control-label {
        margin-bottom: 0;
      }
      &.open {
        height: ${CTAS_CVAS_SCHEMA_FORM_HEIGHT}px;
        padding-right: ${theme.gridUnit * 5}px;
      }
    }
  `}
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

export const StyledAlignment = styled.div`
  padding: 0 ${({ theme }) => theme.gridUnit * 4}px;
  margin-top: ${({ theme }) => theme.gridUnit * 6}px;
`;

export const buttonLinkStyles = (theme: SupersetTheme) => css`
  font-weight: ${theme.typography.weights.normal};
  text-transform: initial;
  padding-right: ${theme.gridUnit * 2}px;
`;

export const importDbButtonLinkStyles = (theme: SupersetTheme) => css`
  font-size: ${theme.gridUnit * 3.5}px;
  font-weight: ${theme.typography.weights.normal};
  text-transform: initial;
  padding-right: ${theme.gridUnit * 2}px;
`;

export const alchemyButtonLinkStyles = (theme: SupersetTheme) => css`
  font-weight: ${theme.typography.weights.normal};
  text-transform: initial;
  padding: ${theme.gridUnit * 8}px 0 0;
  margin-left: 0px;
`;

export const TabHeader = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0px;

  .helper {
    color: ${({ theme }) => theme.colors.grayscale.base};
    font-size: ${({ theme }) => theme.typography.sizes.s}px;
    margin: 0px;
  }
`;

export const CreateHeaderTitle = styled.div`
  color: ${({ theme }) => theme.colors.grayscale.dark2};
  font-weight: ${({ theme }) => theme.typography.weights.bold};
  font-size: ${({ theme }) => theme.typography.sizes.m}px;
`;

export const CreateHeaderSubtitle = styled.div`
  color: ${({ theme }) => theme.colors.grayscale.dark1};
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
`;

export const EditHeaderTitle = styled.div`
  color: ${({ theme }) => theme.colors.grayscale.light1};
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  text-transform: uppercase;
`;

export const EditHeaderSubtitle = styled.div`
  color: ${({ theme }) => theme.colors.grayscale.dark1};
  font-size: ${({ theme }) => theme.typography.sizes.l}px;
  font-weight: ${({ theme }) => theme.typography.weights.bold};
`;

export const CredentialInfoForm = styled.div`
  .catalog-type-select {
    margin: 0 0 20px;
  }

  .label-select {
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.grayscale.dark1};
    font-size: 11px;
    margin: 0 5px ${({ theme }) => theme.gridUnit * 2}px;
  }

  .label-paste {
    color: ${({ theme }) => theme.colors.grayscale.light1};
    font-size: 11px;
    line-height: 16px;
  }

  .input-container {
    margin: ${({ theme }) => theme.gridUnit * 7}px 0;
    display: flex;
    flex-direction: column;
}
  }
  .input-form {
    height: 100px;
    width: 100%;
    border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
    border-radius: ${({ theme }) => theme.gridUnit}px;
    resize: vertical;
    padding: ${({ theme }) => theme.gridUnit * 1.5}px
      ${({ theme }) => theme.gridUnit * 2}px;
    &::placeholder {
      color: ${({ theme }) => theme.colors.grayscale.light1};
    }
  }

  .input-container {
    .input-upload {
      display: none !important;
    }
    .input-upload-current {
      display: flex;
      justify-content: space-between;
    }
    .input-upload-btn {
      width: ${({ theme }) => theme.gridUnit * 32}px
    }
  }`;

export const SelectDatabaseStyles = styled.div`
  .preferred {
    .superset-button {
      margin-left: 0;
    }
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    margin: ${({ theme }) => theme.gridUnit * 4}px;
  }

  .preferred-item {
    width: 32%;
    margin-bottom: ${({ theme }) => theme.gridUnit * 2.5}px;
  }

  .available {
    margin: ${({ theme }) => theme.gridUnit * 4}px;
    .available-label {
      font-size: ${({ theme }) => theme.typography.sizes.l}px;
      font-weight: ${({ theme }) => theme.typography.weights.bold};
      margin: ${({ theme }) => theme.gridUnit * 6}px 0;
    }
    .available-select {
      width: 100%;
    }
  }

  .label-available-select {
    text-transform: uppercase;
    font-size: ${({ theme }) => theme.typography.sizes.s}px;
  }

  .control-label {
    color: ${({ theme }) => theme.colors.grayscale.dark1};
    font-size: ${({ theme }) => theme.typography.sizes.s}px;
    margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;
  }
`;

export const StyledFooterButton = styled(Button)`
  width: ${({ theme }) => theme.gridUnit * 40}px;
`;

export const StyledStickyHeader = styled.div`
  position: sticky;
  top: 0;
  z-index: ${({ theme }) => theme.zIndex.max};
  background: ${({ theme }) => theme.colors.grayscale.light5};
  height: auto;
`;

export const StyledCatalogTable = styled.div`
  margin-bottom: 16px;

  .catalog-type-select {
    margin: 0 0 20px;
  }

  .gsheet-title {
    font-size: ${({ theme }) => theme.typography.sizes.l}px;
    font-weight: ${({ theme }) => theme.typography.weights.bold};
    margin: ${({ theme }) => theme.gridUnit * 10}px 0 16px;
  }

  .catalog-label {
    margin: 0 0 7px;
  }

  .catalog-name {
    display: flex;
    .catalog-name-input {
      width: 95%;
      margin-bottom: 0px;
    }
  }

  .catalog-name-url {
    margin: 4px 0;
    width: 95%;
  }

  .catalog-add-btn {
    width: 95%;
  }
`;

export const StyledUploadWrapper = styled.div`
  .ant-progress-inner {
    display: none;
  }

  .ant-upload-list-item-card-actions {
    display: none;
  }
`;
