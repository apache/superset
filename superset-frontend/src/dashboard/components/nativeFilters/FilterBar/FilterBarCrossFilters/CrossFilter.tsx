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

import React, { useCallback } from 'react';
import { styled, t, css, useTheme } from '@superset-ui/core';
import { CrossFilterIndicator } from 'src/dashboard/components/nativeFilters/selectors';
import Icons from 'src/components/Icons';
import { useDispatch } from 'react-redux';
import { setFocusedNativeFilter } from 'src/dashboard/actions/nativeFilters';
import { Tag } from 'src/components';
import { Tooltip } from 'src/components/Tooltip';
import useCSSTextTruncation from 'src/hooks/useTruncation/useCSSTextTruncation';
import { FilterBarOrientation } from 'src/dashboard/types';
import { updateDataMask } from 'src/dataMask/actions';

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
  filter: CrossFilterIndicator;
  orientation: FilterBarOrientation;
  removeCrossFilter: (filterId: number) => void;
}) => {
  const { filter, orientation, removeCrossFilter } = props;
  const theme = useTheme();
  const [columnRef, columnIsTruncated] =
    useCSSTextTruncation<HTMLSpanElement>();
  const [valueRef, valueIsTruncated] = useCSSTextTruncation<HTMLSpanElement>();

  return (
    <Tag
      css={css`
        ${orientation === FilterBarOrientation.VERTICAL
          ? `
            margin-top: ${theme.gridUnit * 2}px;
          `
          : `
            margin-left: ${theme.gridUnit * 2}px;
          `}
      `}
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
    </Tag>
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
          line-height: 20px;
          ${ellipsisCss}
        `}
        ref={titleRef}
      >
        {title}
      </span>
    </Tooltip>
  );
};

const CrossFilter = (props: {
  filter: CrossFilterIndicator;
  orientation: FilterBarOrientation;
  last?: boolean;
}) => {
  const { filter, orientation, last } = props;
  const theme = useTheme();
  const dispatch = useDispatch();

  const onHighlightFilterSource = useCallback(
    (path?: string[]) => {
      if (path) {
        dispatch(setFocusedNativeFilter(path[0]));
      }
    },
    [dispatch],
  );

  const handleRemoveCrossFilter = (chartId: number) => {
    dispatch(
      updateDataMask(chartId, {
        extraFormData: {
          filters: [],
        },
        filterState: {
          value: null,
          selectedValues: null,
        },
      }),
    );
  };

  return (
    <div
      key={`${filter.name}${filter.emitterId}`}
      css={css`
        ${orientation === FilterBarOrientation.VERTICAL
          ? `
            display: block;
            margin-top: ${theme.gridUnit * 4}px;
          `
          : `
            display: flex;
          `}
      `}
    >
      <StyledCrossFilterTitle
        onClick={() => onHighlightFilterSource(filter.path)}
        role="button"
        tabIndex={0}
      >
        <CrossFilterChartTitle
          title={filter.name}
          orientation={orientation || FilterBarOrientation.HORIZONTAL}
        />
        <Tooltip title={t('Locate the chart')}>
          <StyledIconSearch iconSize="s" />
        </Tooltip>
      </StyledCrossFilterTitle>
      {(filter.column || filter.value) && (
        <CrossFilterTag
          filter={filter}
          orientation={orientation}
          removeCrossFilter={handleRemoveCrossFilter}
        />
      )}
      {last && (
        <span
          css={css`
            ${orientation === FilterBarOrientation.HORIZONTAL
              ? `
                width: 1px;
                height: 22px;
                margin-left: ${theme.gridUnit * 3}px;
              `
              : `
                width: 100%;
                height: 1px;
                display: block;
                margin-bottom: ${theme.gridUnit * 3}px;
                margin-top: ${theme.gridUnit * 3}px;
            `}
            border: 1px solid ${theme.colors.grayscale.light2};
          `}
        />
      )}
    </div>
  );
};

export default CrossFilter;
