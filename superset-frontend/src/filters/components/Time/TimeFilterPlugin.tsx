// DODO was here
import { styled, NO_TIME_RANGE, TimeRangeEndType } from '@superset-ui/core'; // DODO changed 44211759
import { useCallback, useEffect } from 'react';
import DateFilterControl from 'src/explore/components/controls/DateFilterControl';
import { PluginFilterTimeProps } from './types';
import { FilterPluginStyle } from '../common';

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

export default function TimeFilterPlugin(props: PluginFilterTimeProps) {
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
    // DODO changed 44211759
    (timeRange?: string, timeRangeEndType?: TimeRangeEndType): void => {
      const isSet = timeRange && timeRange !== NO_TIME_RANGE;
      setDataMask({
        extraFormData: isSet
          ? {
              time_range: timeRange,
              time_range_end_type: timeRangeEndType, // DODO added 44211759
            }
          : {},
        filterState: {
          value: isSet ? timeRange : undefined,
          timeRangeEndType: isSet ? timeRangeEndType : undefined, // DODO added 44211759
        },
      });
    },
    [setDataMask],
  );

  useEffect(() => {
    handleTimeRangeChange(filterState.value, filterState?.timeRangeEndType); // DODO changed 44211759
  }, [filterState.value, filterState?.timeRangeEndType]); // DODO changed 44211759

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
        <DateFilterControl
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
