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
import { css, styled } from '@apache-superset/core/theme';
import { StyledChartContainer } from '../styles';

const tint = (color: string, percent: number, base: string) =>
  `color-mix(in srgb, ${color} ${percent}%, ${base})`;

export const TreeTableContainer = styled(StyledChartContainer)`
  ${({ theme }) => {
    const openTint = tint(theme.colorPrimary, 4.5, theme.colorBgContainer);
    const childTint = tint(theme.colorPrimary, 1.5, theme.colorBgContainer);
    const barColor = tint(theme.colorPrimary, 36, theme.colorBgContainer);
    const quietText = tint(
      theme.colorTextSecondary,
      44,
      theme.colorTextTertiary,
    );
    const padY = theme.sizeUnit * 3;
    const padRight = theme.sizeUnit * 4;
    const gap = theme.sizeUnit * 4;
    const barInset = theme.sizeUnit * 9;
    const textInset = theme.sizeUnit * 11;
    const toggleSize = theme.sizeUnit * 4;
    return css`
      .tree-table-toolbar {
        padding-bottom: ${theme.sizeUnit * 2}px;
      }

      .tree-table-toolbar .ant-btn {
        height: ${theme.controlHeightSM}px;
        padding-inline: ${theme.sizeUnit * 2}px;
        font-size: ${theme.fontSizeSM}px;
        font-weight: 400;
        line-height: ${theme.lineHeight};
        border-radius: ${theme.borderRadiusSM}px;
        color: ${theme.colorText};
        background: ${theme.colorBgContainer};
        border-color: ${theme.colorBorder};
        box-shadow: none;
      }

      .tree-table-toolbar .ant-btn-icon-only {
        width: ${theme.controlHeightSM}px;
        padding-inline: 0;
      }

      .tree-table-toolbar .ant-btn:not(:disabled):hover,
      .tree-table-toolbar .ant-btn:not(:disabled):active {
        border-color: ${theme.colorPrimary};
        color: ${theme.colorText};
        background: ${theme.colorBgContainer};
      }

      .ag-full-width-row {
        background: ${childTint};
      }

      .tree-table-open-area {
        font-size: ${theme.fontSizeSM}px;
      }

      .tree-table-open-area > .ant-flex {
        padding-block: ${padY}px;
        padding-inline: ${barInset}px ${padRight}px;
      }

      .tree-table-open-area
        > .ant-flex
        > [role='group']:not(.tree-table-child-group) {
        margin-inline: -${barInset}px -${padRight}px;
        padding-inline: ${textInset}px ${padRight}px;
        background: ${openTint};
        box-shadow:
          0 -${padY}px 0 ${openTint},
          0 ${padY}px 0 ${openTint};
      }

      .tree-table-open-area
        > .ant-flex
        > [role='group']:not(.tree-table-child-group):not(:last-child) {
        box-shadow:
          0 -${padY}px 0 ${openTint},
          0 ${gap - 1}px 0 ${openTint},
          0 ${gap}px 0 ${theme.colorSplit};
      }

      .tree-table-open-area .ant-typography {
        font-size: ${theme.fontSizeSM}px;
      }

      .tree-table-detail-fields {
        display: grid;
        grid-template-columns: repeat(
          auto-fit,
          minmax(${theme.sizeUnit * 30}px, 1fr)
        );
        gap: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 6}px;
      }

      .tree-table-detail-fields > * {
        min-width: 0;
        overflow-wrap: anywhere;
        white-space: normal;
      }

      .tree-table-detail-label {
        color: ${quietText};
      }

      .tree-table-child-group {
        border-inline-start: ${theme.sizeUnit * 0.75}px solid ${barColor};
      }

      .tree-table-child-group > .loading,
      .tree-table-child-group > .ant-flex:last-child {
        padding-inline-start: ${theme.sizeUnit * 3}px;
      }

      .tree-table-child-group .ag-root-wrapper {
        border: none;
      }

      .tree-table-child-group
        .ag-grid-scrolling-rows.ag-layout-auto-height:has(.ag-row) {
        min-height: 0;
      }

      .tree-table-child-group .ag-row:not(.ag-full-width-row) {
        background: ${childTint};
        --ag-row-border: solid 1px ${theme.colorBorderSecondary};
      }

      .tree-table-child-group .ag-header,
      .tree-table-child-group .ag-header-row,
      .tree-table-child-group .ag-header-cell {
        background: ${openTint};
        color: ${quietText};
      }

      .tree-table-child-group .ag-header-cell-text {
        font-weight: 600;
      }

      .tree-table-child-group .ag-header-cell:focus-visible {
        outline: ${theme.sizeUnit / 2}px solid ${theme.colorPrimary};
        outline-offset: -${theme.sizeUnit / 2}px;
      }

      .ag-row:not(.ag-full-width-row):has(button[aria-expanded='true']) {
        background: ${openTint};
        --ag-row-border: solid 1px ${theme.colorBorderSecondary};
      }

      .ag-row .ant-btn.tree-table-expand,
      .ag-row .ant-btn.tree-table-expand:not(:disabled):hover,
      .ag-row .ant-btn.tree-table-expand:not(:disabled):active {
        position: relative;
        inset-block-start: round(down, calc((100% - ${toggleSize}px) / 2), 1px);
        width: ${toggleSize}px;
        min-width: ${toggleSize}px;
        height: ${toggleSize}px;
        padding: 0;
        border: 1px solid ${theme.colorBorder};
        border-radius: ${theme.sizeUnit * 0.75}px;
        background: ${theme.colorBgContainer};
        color: ${theme.colorText};
      }

      .ag-cell[col-id='tree_table_expand'] {
        display: flex;
        align-items: flex-start;
      }

      .ag-row button:focus-visible {
        outline: ${theme.sizeUnit / 2}px solid ${theme.colorPrimary};
        outline-offset: ${theme.sizeUnit / 2}px;
      }
    `;
  }}
`;
