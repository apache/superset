import { useState } from 'react';
// eslint-disable-next-line no-restricted-imports
import { Tabs, Button, Input, Radio } from 'antd';
import { ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react';
import dayjs, { Dayjs, ManipulateType } from 'dayjs';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import { useTheme } from '@superset-ui/core';
import {
  FilterContainer,
  CalendarGrid,
  CalendarHeader,
  CalendarCell,
  DateInput,
  ActualTimeRange,
  DynamicFilterTabs,
  RadioGroup,
  StyledCheckbox,
  ButtonGroup,
  IconButton,
  CalendarWrapper,
  AbsoluteModeContainer,
  RelativeModeContainer,
  FilterTitle,
  TimeRangeTitle,
  TimeRangeValue,
  FooterContainer,
  ButtonContainer,
  ShortcutsContainer,
  ShortcutButton,
} from './styles';

// Initialize the quarter plugin
dayjs.extend(quarterOfYear);

type FilterMode = 'absolute' | 'relative' | 'advanced';
type TimeUnit = 'day' | 'week' | 'month' | 'quarter' | 'year';
type TimePrefix = 'last' | 'current' | 'previous';

interface DateFilterProps {
  onApply: (dates: [Dayjs, Dayjs]) => void;
  onCancel: () => void;
}

const ChevronsLeft = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    className="lucide lucide-chevrons-left-icon lucide-chevrons-left"
  >
    <path d="m11 17-5-5 5-5" />
    <path d="m18 17-5-5 5-5" />
  </svg>
);

const DateFilter: React.FC<DateFilterProps> = ({ onApply, onCancel }) => {
  const theme = useTheme();
  const [mode, setMode] = useState<FilterMode>('absolute');
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [selectedDates, setSelectedDates] = useState<
    [Dayjs | null, Dayjs | null]
  >([null, null]);
  const [selectedTimeUnit, setSelectedTimeUnit] = useState<{
    prefix: TimePrefix;
    unit: TimeUnit;
  }>({
    prefix: 'last',
    unit: 'day',
  });
  const [noFilter, setNoFilter] = useState(false);

  const generateCalendarDays = (month: Dayjs) => {
    const start = month.startOf('month').startOf('week');
    const end = month.endOf('month').endOf('week');
    const days = [];
    let current = start;

    while (current.isBefore(end)) {
      days.push(current);
      current = current.add(1, 'day');
    }

    return days;
  };

  const handleDateClick = (date: Dayjs) => {
    if (noFilter) return;

    if (!selectedDates[0] || (selectedDates[0] && selectedDates[1])) {
      setSelectedDates([date, null]);
    } else {
      const startDate = selectedDates[0];
      if (date.isBefore(startDate)) {
        setSelectedDates([date, startDate]);
      } else {
        setSelectedDates([startDate, date]);
      }
    }
  };

  const handleShortcutClick = (shortcut: string) => {
    if (noFilter) return;

    const now = dayjs();
    let start: Dayjs;
    let end: Dayjs;

    switch (shortcut) {
      case 'today':
        start = now.startOf('day');
        end = now.endOf('day');
        break;
      case 'yesterday':
        start = now.subtract(1, 'day').startOf('day');
        end = now.subtract(1, 'day').endOf('day');
        break;
      case 'currentWeek':
        start = now.startOf('week');
        end = now.endOf('week');
        break;
      case 'currentMonth':
        start = now.startOf('month');
        end = now.endOf('month');
        break;
      case 'currentQuarter':
        start = now.startOf('quarter');
        end = now.endOf('quarter');
        break;
      case 'currentYear':
        start = now.startOf('year');
        end = now.endOf('year');
        break;
      case 'weekToDate':
        start = now.startOf('week');
        end = now;
        break;
      case 'monthToDate':
        start = now.startOf('month');
        end = now;
        break;
      case 'quarterToDate':
        start = now.startOf('quarter');
        end = now;
        break;
      case 'yearToDate':
        start = now.startOf('year');
        end = now;
        break;
      case 'previousWeek':
        start = now.subtract(1, 'week').startOf('week');
        end = now.subtract(1, 'week').endOf('week');
        break;
      case 'previousMonth':
        start = now.subtract(1, 'month').startOf('month');
        end = now.subtract(1, 'month').endOf('month');
        break;
      case 'previousQuarter':
        start = now.subtract(1, 'quarter').startOf('quarter');
        end = now.subtract(1, 'quarter').endOf('quarter');
        break;
      case 'previousYear':
        start = now.subtract(1, 'year').startOf('year');
        end = now.subtract(1, 'year').endOf('year');
        break;
      case 'lastWeek':
        start = now.subtract(7, 'days').startOf('day');
        end = now.endOf('day');
        break;
      case 'lastMonth':
        start = now.subtract(30, 'days').startOf('day');
        end = now.endOf('day');
        break;
      case 'lastQuarter':
        start = now.subtract(90, 'days').startOf('day');
        end = now.endOf('day');
        break;
      case 'lastYear':
        start = now.subtract(365, 'days').startOf('day');
        end = now.endOf('day');
        break;
      default:
        return;
    }

    setSelectedDates([start, end]);
  };

  const handleTimeSelection = (prefix: TimePrefix, unit: TimeUnit) => {
    if (noFilter) return;

    setSelectedTimeUnit({ prefix, unit });
    let start: Dayjs;
    let end: Dayjs;
    const now = dayjs();

    switch (prefix) {
      case 'last':
        end = now;
        start = now.subtract(
          1,
          unit === 'quarter' ? 'month' : (unit as ManipulateType),
        );
        break;
      case 'current':
        start = now.startOf(unit);
        end = now.endOf(unit);
        break;
      case 'previous':
        end = now.startOf(unit).subtract(1, 'millisecond');
        start = end.subtract(1, unit as ManipulateType).add(1, 'millisecond');
        break;
      default:
        start = now;
        end = now;
    }

    setSelectedDates([start, end]);
  };

  const handleNoFilterChange = (checked: boolean) => {
    setNoFilter(checked);
    if (checked) {
      setSelectedDates([null, null]);
    }
  };

  const renderAbsoluteMode = () => {
    const days = generateCalendarDays(currentMonth);
    const nextMonth = currentMonth.add(1, 'month');
    const daysNext = generateCalendarDays(nextMonth);

    return (
      <AbsoluteModeContainer>
        <CalendarHeader>
          <ButtonGroup>
            <IconButton
              icon={<ChevronsLeft />}
              onClick={() => setCurrentMonth(m => m.subtract(1, 'year'))}
            />
            <IconButton
              icon={<ChevronLeft />}
              onClick={() => setCurrentMonth(m => m.subtract(1, 'month'))}
            />
          </ButtonGroup>
          <span>{currentMonth.format('MMM YYYY')}</span>
          <span>{nextMonth.format('MMM YYYY')}</span>
          <ButtonGroup>
            <IconButton
              icon={<ChevronRight />}
              onClick={() => setCurrentMonth(m => m.add(1, 'month'))}
            />
            <IconButton
              icon={<ChevronsRight />}
              onClick={() => setCurrentMonth(m => m.add(1, 'year'))}
            />
          </ButtonGroup>
        </CalendarHeader>
        <CalendarWrapper>
          <div>
            <CalendarGrid>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <div key={day}>{day}</div>
              ))}
              {days.map(day => (
                <CalendarCell
                  key={day.toString()}
                  isCurrentMonth={day.month() === currentMonth.month()}
                  isSelected={Boolean(
                    selectedDates[0]?.isSame(day, 'day') ||
                      selectedDates[1]?.isSame(day, 'day'),
                  )}
                  isInRange={Boolean(
                    selectedDates[0] &&
                      selectedDates[1] &&
                      day.isAfter(selectedDates[0]) &&
                      day.isBefore(selectedDates[1]),
                  )}
                  onClick={() => handleDateClick(day)}
                >
                  {day.date()}
                </CalendarCell>
              ))}
            </CalendarGrid>
          </div>
          <div>
            <CalendarGrid>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <div key={day}>{day}</div>
              ))}
              {daysNext.map(day => (
                <CalendarCell
                  key={day.toString()}
                  isCurrentMonth={day.month() === nextMonth.month()}
                  isSelected={Boolean(
                    selectedDates[0]?.isSame(day, 'day') ||
                      selectedDates[1]?.isSame(day, 'day'),
                  )}
                  isInRange={Boolean(
                    selectedDates[0] &&
                      selectedDates[1] &&
                      day.isAfter(selectedDates[0]) &&
                      day.isBefore(selectedDates[1]),
                  )}
                  onClick={() => handleDateClick(day)}
                >
                  {day.date()}
                </CalendarCell>
              ))}
            </CalendarGrid>
          </div>
        </CalendarWrapper>
        <ShortcutsContainer>
          <ShortcutButton onClick={() => handleShortcutClick('today')}>
            Today
          </ShortcutButton>
          <ShortcutButton onClick={() => handleShortcutClick('currentWeek')}>
            Current Week
          </ShortcutButton>
          <ShortcutButton onClick={() => handleShortcutClick('currentMonth')}>
            Current Month
          </ShortcutButton>
          <ShortcutButton onClick={() => handleShortcutClick('currentQuarter')}>
            Current Quarter
          </ShortcutButton>
          <ShortcutButton onClick={() => handleShortcutClick('currentYear')}>
            Current Year
          </ShortcutButton>

          <ShortcutButton onClick={() => handleShortcutClick('weekToDate')}>
            Week-to-Date
          </ShortcutButton>
          <ShortcutButton onClick={() => handleShortcutClick('monthToDate')}>
            Month-to-Date
          </ShortcutButton>
          <ShortcutButton onClick={() => handleShortcutClick('quarterToDate')}>
            Quarter-to-Date
          </ShortcutButton>
          <ShortcutButton onClick={() => handleShortcutClick('yearToDate')}>
            Year-to-Date
          </ShortcutButton>
          <ShortcutButton onClick={() => handleShortcutClick('yesterday')}>
            Yesterday
          </ShortcutButton>

          <ShortcutButton onClick={() => handleShortcutClick('previousWeek')}>
            Previous Week
          </ShortcutButton>
          <ShortcutButton onClick={() => handleShortcutClick('previousMonth')}>
            Previous Month
          </ShortcutButton>
          <ShortcutButton
            onClick={() => handleShortcutClick('previousQuarter')}
          >
            Previous Quarter
          </ShortcutButton>
          <ShortcutButton onClick={() => handleShortcutClick('previousYear')}>
            Previous Year
          </ShortcutButton>
          <ShortcutButton onClick={() => handleShortcutClick('lastWeek')}>
            Last Week
          </ShortcutButton>

          <ShortcutButton onClick={() => handleShortcutClick('lastMonth')}>
            Last Month
          </ShortcutButton>
          <ShortcutButton onClick={() => handleShortcutClick('lastQuarter')}>
            Last Quarter
          </ShortcutButton>
          <ShortcutButton onClick={() => handleShortcutClick('lastYear')}>
            Last Year
          </ShortcutButton>
        </ShortcutsContainer>
        <DateInput>
          <div>
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
            <label htmlFor="startDate">START DATE</label>
            <Input
              id="startDate"
              value={selectedDates[0]?.format('YYYY-MM-DD HH:mm:ss')}
              placeholder="Start date"
              readOnly
            />
          </div>
          <div>
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
            <label htmlFor="endDate">END DATE</label>
            <Input
              id="endDate"
              value={selectedDates[1]?.format('YYYY-MM-DD HH:mm:ss')}
              placeholder="End date"
              readOnly
            />
          </div>
        </DateInput>
      </AbsoluteModeContainer>
    );
  };

  const renderRelativeMode = () => {
    const timeUnits: TimeUnit[] = ['day', 'week', 'month', 'quarter', 'year'];

    const renderTimeUnitRadios = (prefix: TimePrefix) => (
      <RadioGroup>
        <Radio.Group
          value={selectedTimeUnit.unit}
          onChange={e => handleTimeSelection(prefix, e.target.value)}
        >
          {timeUnits.map(unit => (
            <Radio key={unit} value={unit}>
              {prefix.charAt(0).toUpperCase() + prefix.slice(1)} {unit}
            </Radio>
          ))}
        </Radio.Group>
      </RadioGroup>
    );

    return (
      <RelativeModeContainer>
        <FilterTitle>QUICK DYNAMIC FILTERS</FilterTitle>
        <DynamicFilterTabs type="card">
          <Tabs.TabPane key="last" tab="Last">
            {renderTimeUnitRadios('last')}
          </Tabs.TabPane>
          <Tabs.TabPane key="current" tab="Current">
            {renderTimeUnitRadios('current')}
          </Tabs.TabPane>
          <Tabs.TabPane key="previous" tab="Previous">
            {renderTimeUnitRadios('previous')}
          </Tabs.TabPane>
        </DynamicFilterTabs>
      </RelativeModeContainer>
    );
  };

  const renderAdvancedMode = () => (
    <RelativeModeContainer>
      <div>
        <FilterTitle htmlFor="advancedStartDate">START DATE</FilterTitle>
        <Input id="advancedStartDate" placeholder="Input" />
      </div>
      <div>
        <FilterTitle htmlFor="advancedEndDate">END DATE</FilterTitle>
        <Input id="advancedEndDate" placeholder="Input" />
      </div>
    </RelativeModeContainer>
  );

  return (
    <FilterContainer>
      <Tabs activeKey={mode} onChange={key => setMode(key as FilterMode)}>
        <Tabs.TabPane key="absolute" tab="Absolute">
          {renderAbsoluteMode()}
        </Tabs.TabPane>
        <Tabs.TabPane key="relative" tab="Relative">
          {renderRelativeMode()}
        </Tabs.TabPane>
        <Tabs.TabPane key="advanced" tab="Advanced">
          {renderAdvancedMode()}
        </Tabs.TabPane>
      </Tabs>
      <ActualTimeRange>
        <TimeRangeTitle>Actual time range</TimeRangeTitle>
        <TimeRangeValue>
          {noFilter ? (
            'No filter'
          ) : (
            <>
              {selectedDates[0]?.format('YYYY-MM-DD HH:mm:ss')}{' '}
              {selectedDates[0] && selectedDates[1] && ' < col < '}
              {selectedDates[1]?.format('YYYY-MM-DD HH:mm:ss')}
            </>
          )}
        </TimeRangeValue>
      </ActualTimeRange>
      <FooterContainer>
        <StyledCheckbox
          checked={noFilter}
          onChange={e => handleNoFilterChange(e.target.checked)}
        >
          No filter
        </StyledCheckbox>
        <ButtonContainer>
          <Button onClick={onCancel}>Cancel</Button>
          <Button
            type="primary"
            onClick={() => {
              if (noFilter) {
                onApply([dayjs().startOf('day'), dayjs().endOf('day')]);
              } else if (selectedDates[0] && selectedDates[1]) {
                onApply([selectedDates[0], selectedDates[1]]);
              }
            }}
            style={{
              background: theme.colors.primary.base,
              borderColor: theme.colors.primary.base,
            }}
          >
            Apply
          </Button>
        </ButtonContainer>
      </FooterContainer>
    </FilterContainer>
  );
};

export default DateFilter;
