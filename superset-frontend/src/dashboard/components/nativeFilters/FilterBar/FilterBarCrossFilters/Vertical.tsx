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

import React, { useCallback, useMemo } from 'react';
import Collapse from 'src/components/Collapse';
import { styled, t, css, useTheme } from '@superset-ui/core';
import { IndicatorWithEmitterType } from 'src/dashboard/components/nativeFilters/selectors';
import Icons from 'src/components/Icons';
import { useDispatch } from 'react-redux';
import { setFocusedNativeFilter } from 'src/dashboard/actions/nativeFilters';
import { Tag } from 'src/components';
import { Tooltip } from 'src/components/Tooltip';
import useCSSTextTruncation from 'src/hooks/useTruncation/useCSSTextTruncation';
import { FilterBarOrientation } from 'src/dashboard/types';

const StyledCollapse = styled(Collapse)`
  ${({ theme }) => `
    .ant-collapse-item > .ant-collapse-header {
      padding-bottom: 0;
    }
    .ant-collapse-item > .ant-collapse-header > .ant-collapse-arrow {
      font-size: ${theme.typography.sizes.xs}px;
      padding-top: ${theme.gridUnit * 3.5}px;
    }
    .ant-collapse-item > .ant-collapse-content > .ant-collapse-content-box {
      padding-top: 0;
    }
  `}
`;

const StyledCrossFilter = styled.div`
  ${({ theme }) => `
    margin-top: ${theme.gridUnit * 4}px;
  `}
`;

const StyledCrossFiltersTitle = styled.span`
  font-size: ${({ theme }) => `${theme.typography.sizes.s}px;`};
`;

const StyledCrossFilterTitle = styled.div`
  ${({ theme }) => `
    display: flex;
    font-size: ${theme.typography.sizes.s}px;
    color: ${theme.colors.grayscale.base};
    vertical-align: middle;
    cursor: pointer;
    align-items: center;
  `}
`;
const StyledIconSearch = styled(Icons.SearchOutlined)`
  ${({ theme }) => `
    color: ${theme.colors.grayscale.light1};
    margin-left: ${theme.gridUnit * 2}px;
    &:hover {
      color: ${theme.colors.grayscale.base};
    }
  `}
`;

const StyledCrossFilterTag = styled(Tag)`
  ${({ theme }) => `
    margin-top: ${theme.gridUnit * 2}px;
  `}
`;

const ellipsisCss = css`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: inline-block;
  vertical-align: middle;
`;

const StyledCrossFilterValue = styled('b')`
  ${({ theme }) => `
    max-width: ${theme.gridUnit * 25}px;
  `}
  ${ellipsisCss}
`;

const StyledCrossFilterColumn = styled('span')`
  ${({ theme }) => `
    max-width: ${theme.gridUnit * 25}px;
    padding-right: ${theme.gridUnit}px;
  `}
  ${ellipsisCss}
`;

const CrossFilterTag = (props: {
  filter: IndicatorWithEmitterType;
  removeCrossFilter: (filterId: number) => void;
}) => {
  const { filter, removeCrossFilter } = props;
  const [columnRef, columnIsTruncated] =
    useCSSTextTruncation<HTMLSpanElement>();
  const [valueRef, valueIsTruncated] = useCSSTextTruncation<HTMLSpanElement>();

  return (
    <StyledCrossFilterTag
      closable
      onClose={() => removeCrossFilter(filter.emitterId)}
    >
      <Tooltip title={columnIsTruncated ? filter.column : null}>
        <StyledCrossFilterColumn ref={columnRef}>
          {filter.column}
        </StyledCrossFilterColumn>
      </Tooltip>
      <Tooltip title={valueIsTruncated ? filter.value : null}>
        <StyledCrossFilterValue ref={valueRef}>
          {filter.value}
        </StyledCrossFilterValue>
      </Tooltip>
    </StyledCrossFilterTag>
  );
};

const CrossFilterChartTitle = (props: {
  title: string;
  orientation: FilterBarOrientation;
}) => {
  const { title, orientation } = props;
  const [titleRef, titleIsTruncated] = useCSSTextTruncation<HTMLSpanElement>();
  const theme = useTheme();
  return (
    <Tooltip title={titleIsTruncated ? title : null}>
      <span
        css={css`
          max-width: ${orientation === FilterBarOrientation.VERTICAL
            ? `${theme.gridUnit * 60}px`
            : `${theme.gridUnit * 15}px`};
          ${ellipsisCss}
        `}
        ref={titleRef}
      >
        {title}
      </span>
    </Tooltip>
  );
};

const FilterBarCrossFiltersVertical = (props: {
  crossFilters: IndicatorWithEmitterType[];
  orientation: FilterBarOrientation;
  removeCrossFilter: (chartId: number) => void;
}) => {
  const { crossFilters, orientation, removeCrossFilter } = props;
  const dispatch = useDispatch();

  const onHighlightFilterSource = useCallback(
    (path?: string[]) => {
      if (path) {
        dispatch(setFocusedNativeFilter(path[0]));
      }
    },
    [dispatch],
  );

  const crossFiltersIndicators = useMemo(
    () =>
      crossFilters.map(filter => (
        <StyledCrossFilter key={filter.emitterId}>
          <StyledCrossFilterTitle
            onClick={() => onHighlightFilterSource(filter.path)}
            role="button"
            tabIndex={0}
          >
            <CrossFilterChartTitle
              title={filter.name}
              orientation={orientation}
            />
            <Tooltip title={t('Locate the chart')}>
              <StyledIconSearch iconSize="xs" />
            </Tooltip>
          </StyledCrossFilterTitle>
          {(filter.column || filter.value) && (
            <CrossFilterTag
              filter={filter}
              removeCrossFilter={removeCrossFilter}
            />
          )}
        </StyledCrossFilter>
      )),
    [crossFilters, onHighlightFilterSource, orientation, removeCrossFilter],
  );

  return (
    <StyledCollapse
      ghost
      defaultActiveKey="crossFilters"
      expandIconPosition="right"
    >
      <Collapse.Panel
        key="crossFilters"
        header={
          <StyledCrossFiltersTitle>
            {t('Cross-filters')}
          </StyledCrossFiltersTitle>
        }
      >
        {crossFiltersIndicators}
      </Collapse.Panel>
    </StyledCollapse>
  );
};

export default FilterBarCrossFiltersVertical;
