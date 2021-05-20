import { styled } from '@superset-ui/core';

export default styled.div`
  table {
    width: 100%;
    min-width: auto;
    max-width: none;
    margin: 0;
  }

  th,
  td {
    min-width: 4.3em;
  }

  thead > tr > th {
    padding-right: 1.4em;
    position: relative;
    background: ${({ theme: { colors } }) => colors.grayscale.light5};
    text-align: left;
  }
  th svg {
    color: ${({ theme: { colors } }) => colors.grayscale.light2};
    position: relative;
    vertical-align: middle;
    margin: 0 ${({ theme: { gridUnit } }) => gridUnit}px;
  }
  th.is-sorted svg {
    color: ${({ theme: { colors } }) => colors.grayscale.base};
  }
  .table > tbody > tr:first-of-type > td,
  .table > tbody > tr:first-of-type > th {
    border-top: 0;
  }

  .dt-controls {
    padding-bottom: 0.65em;
  }
  .dt-metric {
    text-align: right;
  }
  .dt-totals {
    font-weight: bold;
  }
  .dt-is-null {
    color: ${({ theme: { colors } }) => colors.grayscale.light1};
  }
  td.dt-is-filter {
    cursor: pointer;
  }
  td.dt-is-filter:hover {
    background-color: ${({ theme: { colors } }) => colors.secondary.light4};
  }
  td.dt-is-active-filter,
  td.dt-is-active-filter:hover {
    background-color: ${({ theme: { colors } }) => colors.secondary.light3};
  }

  .dt-global-filter {
    float: right;
  }

  .dt-pagination {
    text-align: right;
    /* use padding instead of margin so clientHeight can capture it */
    padding-top: 0.5em;
  }
  .dt-pagination .pagination {
    margin: 0;
  }

  .pagination > li > span.dt-pagination-ellipsis:focus,
  .pagination > li > span.dt-pagination-ellipsis:hover {
    background: ${({ theme: { colors } }) => colors.grayscale.light5};
  }

  .dt-no-results {
    text-align: center;
    padding: 1em 0.6em;
  }
`;
