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
import { Button, JsonEditor } from '@superset-ui/core/components';

const CTAS_CVAS_SCHEMA_FORM_HEIGHT = 108;
const EXPOSE_IN_SQLLAB_FORM_HEIGHT = CTAS_CVAS_SCHEMA_FORM_HEIGHT + 153;
const EXPOSE_ALL_FORM_HEIGHT = EXPOSE_IN_SQLLAB_FORM_HEIGHT + 102;
const MODAL_BODY_HEIGHT = 180.5;

export const no_margin_bottom = css`
  margin-bottom: 0;
`;

export const labelMarginBottom = (theme: SupersetTheme) => css`
  margin-bottom: ${theme.sizeUnit * 2}px;
`;

export const marginBottom = (theme: SupersetTheme) => css`
  margin-bottom: ${theme.sizeUnit * 4}px;
`;

export const StyledFormHeader = styled.header`
  padding: ${({ theme }) => theme.sizeUnit * 2}px
    ${({ theme }) => theme.sizeUnit * 4}px;
  line-height: ${({ theme }) => theme.sizeUnit * 6}px;

  .helper-top {
    padding-bottom: 0;
    color: ${({ theme }) => theme.colorText};
    font-size: ${({ theme }) => theme.fontSizeSM}px;
    margin: 0;
  }

  .subheader-text {
    line-height: ${({ theme }) => theme.sizeUnit * 4.25}px;
  }

  .helper-bottom {
    padding-top: 0;
    color: ${({ theme }) => theme.colorText};
    font-size: ${({ theme }) => theme.fontSizeSM}px;
    margin: 0;
  }

  h4 {
    color: ${({ theme }) => theme.colorText};
    font-size: ${({ theme }) => theme.fontSizeLG}px;
    margin: 0;
    padding: 0;
    line-height: ${({ theme }) => theme.sizeUnit * 8}px;
  }

  .select-db {
    padding-bottom: ${({ theme }) => theme.sizeUnit * 2}px;
    .helper {
      margin: 0;
    }

    h4 {
      margin: 0 0 ${({ theme }) => theme.sizeUnit * 4}px;
    }
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
  margin-bottom: ${theme.sizeUnit * 5}px;
  svg {
    margin-bottom: ${theme.sizeUnit * 0.25}px;
  }
  display: flex;
`;

export const toggleStyle = (theme: SupersetTheme) => css`
  padding-left: ${theme.sizeUnit * 2}px;
  padding-right: ${theme.sizeUnit * 2}px;
`;

export const formScrollableStyles = (theme: SupersetTheme) => css`
  padding: ${theme.sizeUnit * 4}px ${theme.sizeUnit * 4}px 0;
`;

export const antDModalStyles = (theme: SupersetTheme) => css`
  .ant-select-dropdown {
    height: ${theme.sizeUnit * 40}px;
  }

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
`;

export const antDAlertStyles = (theme: SupersetTheme) => css`
  margin: ${theme.sizeUnit * 4}px 0;
`;

export const StyledAlertMargin = styled.div`
  ${({ theme }) => css`
    margin: 0 ${theme.sizeUnit * 4}px ${theme.sizeUnit * 4}px;
  `}
`;

export const antDErrorAlertStyles = (theme: SupersetTheme) => css`
  margin: ${theme.sizeUnit * 8}px ${theme.sizeUnit * 4}px;
`;

export const antdWarningAlertStyles = (theme: SupersetTheme) => css`
  margin: ${theme.sizeUnit * 4}px 0;

  .ant-alert-message {
    margin: 0;
  }
`;

export const formHelperStyles = (theme: SupersetTheme) => css`
  .required {
    margin-left: ${theme.sizeUnit / 2}px;
    color: ${theme.colorError};
  }

  .helper {
    display: block;
    padding: ${theme.sizeUnit}px 0;
    color: ${theme.colorTextSecondary};
    font-size: ${theme.fontSizeSM}px;
    text-align: left;
  }
`;

export const wideButton = (theme: SupersetTheme) => css`
  width: 100%;
  border: 1px solid ${theme.colorPrimaryText};
  color: ${theme.colorPrimaryText};
  &:hover,
  &:focus {
    border: 1px solid ${theme.colorPrimary};
    color: ${theme.colorPrimary};
  }
`;

export const formStyles = (theme: SupersetTheme) => css`
  .form-group {
    margin-bottom: ${theme.sizeUnit * 4}px;
    &-w-50 {
      display: inline-block;
      width: ${`calc(50% - ${theme.sizeUnit * 4}px)`};
      & + .form-group-w-50 {
        margin-left: ${theme.sizeUnit * 8}px;
      }
    }
  }
  .helper {
    color: ${theme.colorTextSecondary};
    font-size: ${theme.fontSizeSM}px;
    margin-top: ${theme.sizeUnit * 1.5}px;
  }
  .ant-tabs-content-holder {
    overflow: auto;
    max-height: 480px;
  }
`;

export const validatedFormStyles = (theme: SupersetTheme) => css`
  label {
    color: ${theme.colorText};
    font-size: ${theme.fontSizeSM}px;
    margin-bottom: 0;
  }
`;

export const StyledInputContainer = styled.div`
  ${({ theme }) => css`
    margin-bottom: ${theme.sizeUnit * 6}px;
    &.mb-0 {
      margin-bottom: 0;
    }
    &.mb-8 {
      margin-bottom: ${theme.sizeUnit * 2}px;
    }

    &.extra-container {
      padding-top: ${theme.sizeUnit * 2}px;
    }

    .input-container {
      display: flex;
      align-items: top;

      label {
        display: flex;
        margin-left: ${theme.sizeUnit * 2}px;
        margin-top: ${theme.sizeUnit * 0.75}px;
        font-family: ${theme.fontFamily};
        font-size: ${theme.fontSize}px;
      }

      i {
        margin: 0 ${theme.sizeUnit}px;
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
      color: ${theme.colorTextPlaceholder};
    }

    textarea,
    input[type='text'],
    input[type='number'] {
      padding: ${theme.sizeUnit * 1.5}px ${theme.sizeUnit * 2}px;
      border-style: none;
      border: 1px solid ${theme.colorBorder};
      border-radius: ${theme.borderRadius}px;

      &[name='name'] {
        flex: 0 1 auto;
        width: 40%;
      }
    }
    &.expandable {
      height: 0;
      overflow: hidden;
      transition: height 0.25s;
      margin-left: ${theme.sizeUnit * 8}px;
      margin-bottom: 0;
      padding: 0;
      &.open {
        height: ${CTAS_CVAS_SCHEMA_FORM_HEIGHT}px;
        padding-right: ${theme.sizeUnit * 5}px;
      }
    }
  `}
`;

export const StyledJsonEditor = styled(JsonEditor)`
  flex: 1 1 auto;
  /* Border is already applied by AceEditor itself */
`;

export const StyledExpandableForm = styled.div`
  padding-top: ${({ theme }) => theme.sizeUnit}px;
  .input-container {
    padding-top: ${({ theme }) => theme.sizeUnit}px;
    padding-bottom: ${({ theme }) => theme.sizeUnit}px;
  }
  &.expandable {
    height: 0;
    overflow: hidden;
    transition: height 0.25s;
    margin-left: ${({ theme }) => theme.sizeUnit * 7}px;
    &.open {
      height: ${EXPOSE_IN_SQLLAB_FORM_HEIGHT}px;
      &.ctas-open {
        height: ${EXPOSE_ALL_FORM_HEIGHT}px;
      }
    }
  }
`;

export const StyledAlignment = styled.div`
  padding: 0 ${({ theme }) => theme.sizeUnit * 4}px;
  margin-top: ${({ theme }) => theme.sizeUnit * 6}px;
`;

export const buttonLinkStyles = (theme: SupersetTheme) => css`
  text-transform: initial;
  padding-right: ${theme.sizeUnit * 2}px;
`;

export const importDbButtonLinkStyles = (theme: SupersetTheme) => css`
  font-size: ${theme.sizeUnit * 3.5}px;
  text-transform: initial;
  padding-right: ${theme.sizeUnit * 2}px;
`;

export const alchemyButtonLinkStyles = (theme: SupersetTheme) => css`
  text-transform: initial;
  padding: ${theme.sizeUnit * 8}px 0 0;
  margin-left: 0px;
`;

export const TabHeader = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0px;

  .helper {
    color: ${({ theme }) => theme.colorTextSecondary};
    font-size: ${({ theme }) => theme.fontSizeSM}px;
    margin: 0px;
  }
`;

export const CreateHeaderTitle = styled.div`
  color: ${({ theme }) => theme.colorText};
  font-weight: ${({ theme }) => theme.fontWeightStrong};
  font-size: ${({ theme }) => theme.fontSize}px;
`;

export const CreateHeaderSubtitle = styled.div`
  color: ${({ theme }) => theme.colorText};
  font-size: ${({ theme }) => theme.fontSizeSM}px;
`;

export const EditHeaderTitle = styled.div`
  color: ${({ theme }) => theme.colorTextSecondary};
  font-size: ${({ theme }) => theme.fontSizeSM}px;
`;

export const EditHeaderSubtitle = styled.div`
  color: ${({ theme }) => theme.colorText};
  font-size: ${({ theme }) => theme.fontSizeLG}px;
  font-weight: ${({ theme }) => theme.fontWeightStrong};
`;

export const CredentialInfoForm = styled.div`
  .catalog-type-select {
    margin: 0 0 20px;
  }

  .label-select {
    color: ${({ theme }) => theme.colorText};
    font-size: 11px;
    margin: 0 5px ${({ theme }) => theme.sizeUnit * 2}px;
  }

  .label-paste {
    color: ${({ theme }) => theme.colorTextSecondary};
    font-size: 11px;
    line-height: 16px;
  }

  .input-container {
    margin: ${({ theme }) => theme.sizeUnit * 4}px 0;
    display: flex;
    flex-direction: column;
}
  }
  .input-form {
    height: 100px;
    width: 100%;
    border: 1px solid ${({ theme }) => theme.colorBorder};
    border-radius: ${({ theme }) => theme.borderRadius}px;
    resize: vertical;
    padding: ${({ theme }) => theme.sizeUnit * 1.5}px
      ${({ theme }) => theme.sizeUnit * 2}px;
    &::placeholder {
      color: ${({ theme }) => theme.colorTextPlaceholder};
    }
  }

  .input-container {
    width: 100%;

    button {
      width: fit-content;
    }

    .credentials-uploaded {
      display: flex;
      align-items: center;
      gap: ${({ theme }) => theme.sizeUnit * 3}px;
      width: fit-content;
    }

    .credentials-uploaded-btn, .credentials-uploaded-remove {
      flex: 0 0 auto;
    }

    /* hide native file upload input element */
    .input-upload {
      display: none !important;
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
    margin: ${({ theme }) => theme.sizeUnit * 4}px;
  }

  .preferred-item {
    width: 32%;
    margin-bottom: ${({ theme }) => theme.sizeUnit * 2.5}px;
  }

  .available {
    margin: ${({ theme }) => theme.sizeUnit * 4}px;
    .available-label {
      font-size: ${({ theme }) => theme.fontSizeLG}px;
      font-weight: ${({ theme }) => theme.fontWeightStrong};
      margin: ${({ theme }) => theme.sizeUnit * 6}px 0;
    }
    .available-select {
      width: 100%;
    }
  }

  .label-available-select {
    font-size: ${({ theme }) => theme.fontSizeSM}px;
  }
`;

export const StyledFooterButton = styled(Button)`
  width: ${({ theme }) => theme.sizeUnit * 40}px;
`;

export const StyledStickyHeader = styled.div`
  position: sticky;
  top: 0;
  z-index: ${({ theme }) => theme.zIndexPopupBase};
  background: ${({ theme }) => theme.colorBgLayout};
  height: auto;
`;

export const StyledCatalogTable = styled.div`
  margin-bottom: 16px;

  .catalog-type-select {
    margin: 0 0 20px;
  }

  .gsheet-title {
    font-size: ${({ theme }) => theme.fontSizeLG}px;
    font-weight: ${({ theme }) => theme.fontWeightStrong};
    margin: ${({ theme }) => theme.sizeUnit * 10}px 0 16px;
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
  margin: ${({ theme }) => theme.sizeUnit * 4}px;
  .ant-progress-inner {
    display: none;
  }

  .ant-upload-list-item-card-actions {
    display: none;
  }
`;
