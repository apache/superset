/* eslint-disable theme-colors/no-literal-colors */
import React from 'react';
import { styled } from '@superset-ui/core';
import { Tooltip as BaseTooltip } from 'antd';

const TitlePanelAdditionalItemsWrapper = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-left: ${theme.gridUnit}px;
  `}
`;

const ChartUsageContainer = styled.div`
  display: flex;
  align-items: center;
  ${({ theme }) => `
    margin-left: ${theme.gridUnit * 2}px;
    padding: ${theme.gridUnit}px ${theme.gridUnit * 2}px;
    background-color: ${theme.colors.grayscale.light3};
    font-size: 12px;
    border-radius: ${theme.borderRadius}px;
  `}
  min-width: 104px;
  line-height: 1;
`;

const DashboardsWrapper = styled.div`
  display: flex;
  align-items: center;
  max-width: 190px;
  min-width: 110px;
  cursor: default;

  .metadata-icon {
    color: rgb(102, 102, 102);
    padding-right: 8px;
  }
  .metadata-text {
    min-width: 70px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-decoration: none;
  }
`;

const StyledUl = styled.ul`
  padding: 0;
  margin: 0;
  list-style: none;
`;

const StyledLi = styled.li`
  padding: 0;

  a {
    ${({ theme }) => `
      color: ${theme.colors.grayscale.light1};
      font-size: 12px;
    `}
  }
`;
const FundProjectIcon = () => (
  <span role="img" className="anticon metadata-icon css-cusohb">
    <span
      role="img"
      aria-label="fund-projection-screen"
      // @ts-ignore
      width="1em"
      height="1em"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      viewbox="0 0 24 24"
      className="anticon anticon-fund-projection-screen"
    >
      <svg
        viewBox="64 64 896 896"
        focusable="false"
        data-icon="fund-projection-screen"
        width="1em"
        height="1em"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M312.1 591.5c3.1 3.1 8.2 3.1 11.3 0l101.8-101.8 86.1 86.2c3.1 3.1 8.2 3.1 11.3 0l226.3-226.5c3.1-3.1 3.1-8.2 0-11.3l-36.8-36.8a8.03 8.03 0 00-11.3 0L517 485.3l-86.1-86.2a8.03 8.03 0 00-11.3 0L275.3 543.4a8.03 8.03 0 000 11.3l36.8 36.8z" />
        <path d="M904 160H548V96c0-4.4-3.6-8-8-8h-56c-4.4 0-8 3.6-8 8v64H120c-17.7 0-32 14.3-32 32v520c0 17.7 14.3 32 32 32h356.4v32L311.6 884.1a7.92 7.92 0 00-2.3 11l30.3 47.2v.1c2.4 3.7 7.4 4.7 11.1 2.3L512 838.9l161.3 105.8c3.7 2.4 8.7 1.4 11.1-2.3v-.1l30.3-47.2a8 8 0 00-2.3-11L548 776.3V744h356c17.7 0 32-14.3 32-32V192c0-17.7-14.3-32-32-32zm-40 512H160V232h704v440z" />
      </svg>
    </span>
  </span>
);

export {
  TitlePanelAdditionalItemsWrapper,
  DashboardsWrapper,
  ChartUsageContainer,
  BaseTooltip,
  FundProjectIcon,
  StyledUl,
  StyledLi,
};
