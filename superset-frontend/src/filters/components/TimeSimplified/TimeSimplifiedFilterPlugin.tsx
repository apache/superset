import { styled, NO_TIME_RANGE } from '@superset-ui/core';
import React, { useCallback, useEffect } from 'react';
import { PluginFilterTimeProps } from './types';
import { FilterPluginStyle } from '../common';
import FilterControl from './FilterLabel';

const TimeFilterStyles = styled(FilterPluginStyle)`
  display: flex;
  align-items: center;
  overflow-x: auto;

  & .ant-tag {
    margin-right: 0;
  }
`;

const ControlContainer = styled.div<{
  validateStatus?: 'error' | 'warning' | 'info';
}>`
  display: flex;
  height: 100%;
  max-width: 100%;
  width: 100%;
  & > div,
  & > div:hover {
    ${({ validateStatus, theme }) =>
      validateStatus && `border-color: ${theme.colors[validateStatus]?.base}`}
  }
`;

export default function TimeSimplifiedFilterPlugin(
  props: PluginFilterTimeProps,
) {
  const {
    setDataMask,
    setHoveredFilter,
    unsetHoveredFilter,
    setFocusedFilter,
    unsetFocusedFilter,
    setFilterActive,
    width,
    height,
    filterState,
    inputRef,
    isOverflowingFilterBar = false,
  } = props;

  const handleTimeRangeChange = useCallback(
    (timeRange?: string): void => {
      const isSet = timeRange && timeRange !== NO_TIME_RANGE;
      setDataMask({
        extraFormData: isSet
          ? {
              time_range: timeRange,
            }
          : {},
        filterState: {
          value: isSet ? timeRange : undefined,
        },
      });
    },
    [setDataMask],
  );

  useEffect(() => {
    handleTimeRangeChange(filterState.value);
  }, [filterState.value]);

  return props.formData?.inView ? (
    <TimeFilterStyles width={width} height={height}>
      <ControlContainer
        ref={inputRef}
        validateStatus={filterState.validateStatus}
        onFocus={setFocusedFilter}
        onBlur={unsetFocusedFilter}
        onMouseEnter={setHoveredFilter}
        onMouseLeave={unsetHoveredFilter}
      >
        <FilterControl
          value={filterState.value || NO_TIME_RANGE}
          name="time_range"
          onChange={handleTimeRangeChange}
          onOpenPopover={() => setFilterActive(true)}
          onClosePopover={() => {
            setFilterActive(false);
            unsetHoveredFilter();
            unsetFocusedFilter();
          }}
          isOverflowingFilterBar={isOverflowingFilterBar}
        />
      </ControlContainer>
    </TimeFilterStyles>
  ) : null;
}
