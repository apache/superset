// DODO was here

import { css, styled } from '@superset-ui/core';

export const Styles = styled.div`
  ${({ theme, isDashboardEditMode }) => css`
    table.pvtTable {
      position: ${isDashboardEditMode ? 'inherit' : 'relative'};
      width: calc(100% - ${theme.gridUnit}px);
      font-size: ${theme.typography.sizes.s}px;
      text-align: left;
      margin: ${theme.gridUnit}px;
      border-collapse: separate;
      font-family: ${theme.typography.families.sansSerif};
      line-height: 1.4;
    }

    table thead {
      position: ${isDashboardEditMode ? 'inherit' : 'sticky'};
      top: 0;
    }

    table tbody tr {
      font-feature-settings: 'tnum' 1;
    }

    table.pvtTable thead tr th,
    table.pvtTable tbody tr th {
      background-color: ${theme.colors.grayscale.light5};
      border-top: 1px solid ${theme.colors.grayscale.light2};
      border-left: 1px solid ${theme.colors.grayscale.light2};
      font-size: ${theme.typography.sizes.s}px;
      padding: ${theme.gridUnit}px;
      font-weight: ${theme.typography.weights.normal};
    }

    table.pvtTable tbody tr.pvtRowTotals {
      position: ${isDashboardEditMode ? 'inherit' : 'sticky'};
      bottom: 0;
    }

    table.pvtTable thead tr:last-of-type th,
    table.pvtTable thead tr:first-of-type th.pvtTotalLabel,
    table.pvtTable thead tr:nth-last-of-type(2) th.pvtColLabel,
    table.pvtTable thead th.pvtSubtotalLabel,
    table.pvtTable tbody tr:last-of-type th,
    table.pvtTable tbody tr:last-of-type td {
      border-bottom: 1px solid ${theme.colors.grayscale.light2};
    }

    table.pvtTable
      thead
      tr:last-of-type:not(:only-child)
      th.pvtAxisLabel
      ~ th.pvtColLabel,
    table.pvtTable tbody tr:first-of-type th,
    table.pvtTable tbody tr:first-of-type td {
      border-top: none;
    }

    table.pvtTable tbody tr td:last-of-type,
    table.pvtTable thead tr th:last-of-type:not(.pvtSubtotalLabel) {
      border-right: 1px solid ${theme.colors.grayscale.light2};
    }

    table.pvtTable
      thead
      tr:last-of-type:not(:only-child)
      th.pvtAxisLabel
      + .pvtTotalLabel {
      border-right: none;
    }

    table.pvtTable tr th.active {
      background-color: ${theme.colors.primary.light3};
    }

    table.pvtTable .pvtTotalLabel {
      text-align: right;
      font-weight: ${theme.typography.weights.bold};
    }

    table.pvtTable .pvtSubtotalLabel {
      font-weight: ${theme.typography.weights.bold};
    }

    table.pvtTable tbody tr td {
      // DODO changed
      color: ${theme.colors.text.help || '#000'};
      padding: ${theme.gridUnit}px;
      background-color: ${theme.colors.grayscale.light5};
      border-top: 1px solid ${theme.colors.grayscale.light2};
      border-left: 1px solid ${theme.colors.grayscale.light2};
      vertical-align: top;
      text-align: right;
    }

    table.pvtTable tbody tr th.pvtRowLabel {
      vertical-align: baseline;
    }

    .pvtTotal,
    .pvtGrandTotal {
      font-weight: ${theme.typography.weights.bold};
    }

    table.pvtTable tbody tr td.pvtRowTotal {
      vertical-align: middle;
    }

    .toggle-wrapper {
      white-space: nowrap;
    }

    .toggle-wrapper > .toggle-val {
      white-space: normal;
    }

    .toggle {
      padding-right: ${theme.gridUnit}px;
      cursor: pointer;
    }

    .hoverable:hover {
      background-color: ${theme.colors.primary.light4};
      cursor: pointer;
    }
  `}
`;
