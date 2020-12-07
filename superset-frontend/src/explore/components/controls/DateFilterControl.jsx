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
import React from 'react';
import PropTypes from 'prop-types';
import { FormControl, FormGroup, InputGroup, Radio } from 'react-bootstrap';
import { Tooltip } from 'src/common/components/Tooltip';
import Popover from 'src/common/components/Popover';
import { Select, Input } from 'src/common/components';
import Button from 'src/components/Button';
import Datetime from 'react-datetime';
import 'react-datetime/css/react-datetime.css';
import moment from 'moment';
import { t, styled, withTheme } from '@superset-ui/core';

import Tabs from 'src/common/components/Tabs';
import {
  buildTimeRangeString,
  formatTimeRange,
} from 'src/explore/dateFilterUtils';
import Label from 'src/components/Label';
import './DateFilterControl.less';
import ControlHeader from '../ControlHeader';
import PopoverSection from '../../../components/PopoverSection';

const TYPES = Object.freeze({
  DEFAULTS: 'defaults',
  CUSTOM_START_END: 'custom_start_end',
  CUSTOM_RANGE: 'custom_range',
});
const TABS = Object.freeze({
  DEFAULTS: 'defaults',
  CUSTOM: 'custom',
});
const RELATIVE_TIME_OPTIONS = Object.freeze({
  LAST: 'Last',
  NEXT: 'Next',
});
const COMMON_TIME_FRAMES = [
  'Last day',
  'Last week',
  'Last month',
  'Last quarter',
  'Last year',
  'No filter',
];
const TIME_GRAIN_OPTIONS = [
  'seconds',
  'minutes',
  'hours',
  'days',
  'weeks',
  'months',
  'years',
];

const MOMENT_FORMAT = 'YYYY-MM-DD[T]HH:mm:ss';
const DEFAULT_SINCE = moment()
  .utc()
  .startOf('day')
  .subtract(7, 'days')
  .format(MOMENT_FORMAT);
const DEFAULT_UNTIL = moment().utc().startOf('day').format(MOMENT_FORMAT);
const SEPARATOR = ' : ';
const FREEFORM_TOOLTIP = t(
  'Superset supports smart date parsing. Strings like `3 weeks ago`, `last sunday`, or ' +
    '`2 weeks from now` can be used.',
);

const propTypes = {
  animation: PropTypes.bool,
  name: PropTypes.string.isRequired,
  label: PropTypes.string,
  description: PropTypes.string,
  onChange: PropTypes.func,
  value: PropTypes.string,
  height: PropTypes.number,
  onOpenDateFilterControl: PropTypes.func,
  onCloseDateFilterControl: PropTypes.func,
  endpoints: PropTypes.arrayOf(PropTypes.string),
};

const defaultProps = {
  animation: true,
  onChange: () => {},
  value: 'Last week',
  onOpenDateFilterControl: () => {},
  onCloseDateFilterControl: () => {},
};

function isValidMoment(s) {
  /* Moment sometimes consider invalid dates as valid, eg, "10 years ago" gets
   * parsed as "Fri Jan 01 2010 00:00:00" local time. This function does a
   * better check by comparing a string with a parse/format roundtrip.
   */
  return s === moment(s, MOMENT_FORMAT).format(MOMENT_FORMAT);
}

function getStateFromSeparator(value) {
  const [since, until] = value.split(SEPARATOR, 2);
  return { since, until, type: TYPES.CUSTOM_START_END, tab: TABS.CUSTOM };
}

function getStateFromCommonTimeFrame(value) {
  const units = `${value.split(' ')[1]}s`;
  let sinceMoment;

  if (value === 'No filter') {
    sinceMoment = '';
  } else if (units === 'years') {
    sinceMoment = moment().utc().startOf(units).subtract(1, units);
  } else {
    sinceMoment = moment().utc().startOf('day').subtract(1, units);
  }

  return {
    tab: TABS.DEFAULTS,
    type: TYPES.DEFAULTS,
    common: value,
    since: sinceMoment === '' ? '' : sinceMoment.format(MOMENT_FORMAT),
    until:
      sinceMoment === '' ? '' : sinceMoment.add(1, units).format(MOMENT_FORMAT),
  };
}

function getStateFromCustomRange(value) {
  const [rel, num, grain] = value.split(' ', 3);
  let since;
  let until;
  if (rel === RELATIVE_TIME_OPTIONS.LAST) {
    until = moment().utc().startOf('day').format(MOMENT_FORMAT);
    since = moment()
      .utc()
      .startOf('day')
      .subtract(num, grain)
      .format(MOMENT_FORMAT);
  } else {
    until = moment().utc().startOf('day').add(num, grain).format(MOMENT_FORMAT);
    since = moment().startOf('day').format(MOMENT_FORMAT);
  }
  return {
    tab: TABS.CUSTOM,
    type: TYPES.CUSTOM_RANGE,
    common: null,
    rel,
    num,
    grain,
    since,
    until,
  };
}

const TimeFramesStyles = styled.div`
  .radio {
    margin: ${({ theme }) => theme.gridUnit}px 0;
  }
`;

const PopoverContentStyles = styled.div`
  width: ${({ theme }) => theme.gridUnit * 60}px;

  .timeframes-container {
    margin-left: ${({ theme }) => theme.gridUnit * 2}px;
  }

  .relative-timerange-container {
    display: flex;
    margin-top: ${({ theme }) => theme.gridUnit * 2}px;
  }

  .timerange-input {
    width: ${({ theme }) => theme.gridUnit * 15}px;
    margin: 0 ${({ theme }) => theme.gridUnit}px;
  }

  .datetime {
    margin: ${({ theme }) => theme.gridUnit}px 0;
  }

  .ant-tabs {
    overflow: visible;
    & > .ant-tabs-content-holder {
      overflow: visible;
    }
  }
`;

class DateFilterControl extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      type: TYPES.DEFAULTS,
      tab: TABS.DEFAULTS,

      // default time frames, for convenience
      common: COMMON_TIME_FRAMES[0],

      // "last 7 days", "next 4 weeks", etc.
      rel: RELATIVE_TIME_OPTIONS.LAST,
      num: '7',
      grain: TIME_GRAIN_OPTIONS[3],

      // distinct start/end values, either ISO or freeform
      since: DEFAULT_SINCE,
      until: DEFAULT_UNTIL,

      // react-datetime has a `closeOnSelect` prop, but it's buggy... so we
      // handle the calendar visibility here ourselves
      showSinceCalendar: false,
      showUntilCalendar: false,
      sinceViewMode: 'days',
      untilViewMode: 'days',

      popoverVisible: false,
    };

    const { value } = props;
    if (value && value.indexOf(SEPARATOR) >= 0) {
      this.state = { ...this.state, ...getStateFromSeparator(value) };
    } else if (COMMON_TIME_FRAMES.indexOf(value) >= 0) {
      this.state = { ...this.state, ...getStateFromCommonTimeFrame(value) };
    } else if (value) {
      this.state = { ...this.state, ...getStateFromCustomRange(value) };
    }

    this.close = this.close.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.isValidSince = this.isValidSince.bind(this);
    this.isValidUntil = this.isValidUntil.bind(this);
    this.onEnter = this.onEnter.bind(this);
    this.renderInput = this.renderInput.bind(this);
    this.setCustomRange = this.setCustomRange.bind(this);
    this.setCustomStartEnd = this.setCustomStartEnd.bind(this);
    this.setTypeCustomRange = this.setTypeCustomRange.bind(this);
    this.setTypeCustomStartEnd = this.setTypeCustomStartEnd.bind(this);
    this.toggleCalendar = this.toggleCalendar.bind(this);
    this.changeTab = this.changeTab.bind(this);
    this.handleVisibleChange = this.handleVisibleChange.bind(this);
  }

  componentDidMount() {
    document.addEventListener('click', this.handleClick);
  }

  componentWillUnmount() {
    document.removeEventListener('click', this.handleClick);
  }

  onEnter(event) {
    if (event.key === 'Enter') {
      this.close();
    }
  }

  setCustomRange(key, value) {
    const updatedState = { ...this.state, [key]: value };
    const combinedValue = [
      updatedState.rel,
      updatedState.num,
      updatedState.grain,
    ].join(' ');
    this.setState(getStateFromCustomRange(combinedValue));
  }

  setCustomStartEnd(key, value) {
    const closeCalendar =
      (key === 'since' && this.state.sinceViewMode === 'days') ||
      (key === 'until' && this.state.untilViewMode === 'days');
    this.setState(prevState => ({
      type: TYPES.CUSTOM_START_END,
      [key]: typeof value === 'string' ? value : value.format(MOMENT_FORMAT),
      showSinceCalendar: prevState.showSinceCalendar && !closeCalendar,
      showUntilCalendar: prevState.showUntilCalendar && !closeCalendar,
      sinceViewMode: closeCalendar ? 'days' : prevState.sinceViewMode,
      untilViewMode: closeCalendar ? 'days' : prevState.untilViewMode,
    }));
  }

  setTypeCustomRange() {
    this.setState({ type: TYPES.CUSTOM_RANGE });
  }

  setTypeCustomStartEnd() {
    this.setState({ type: TYPES.CUSTOM_START_END });
  }

  changeTab() {
    const { tab } = this.state;
    if (tab === TABS.CUSTOM) {
      this.setState({ tab: TABS.DEFAULTS });
    } else if (tab === TABS.DEFAULTS) {
      this.setState({ tab: TABS.CUSTOM });
    }
  }

  handleClick(e) {
    const { target } = e;
    // switch to `TYPES.CUSTOM_START_END` when the calendar is clicked
    if (this.startEndSectionRef && this.startEndSectionRef.contains(target)) {
      this.setTypeCustomStartEnd();
    }

    // if user click outside popover, popover will hide and we will call onCloseDateFilterControl,
    // but need to exclude OverlayTrigger component to avoid handle click events twice.
    if (target.getAttribute('name') !== 'popover-trigger') {
      if (this.popoverContainer && !this.popoverContainer.contains(target)) {
        this.props.onCloseDateFilterControl();
      }
    }
  }

  close() {
    let val;
    if (
      this.state.type === TYPES.DEFAULTS ||
      this.state.tab === TABS.DEFAULTS
    ) {
      val = this.state.common;
    } else if (this.state.type === TYPES.CUSTOM_RANGE) {
      val = `${this.state.rel} ${this.state.num} ${this.state.grain}`;
    } else {
      val = [this.state.since, this.state.until].join(SEPARATOR);
    }
    this.props.onCloseDateFilterControl();
    this.props.onChange(val);
    this.setState({
      showSinceCalendar: false,
      showUntilCalendar: false,
      popoverVisible: false,
    });
  }

  isValidSince(date) {
    return (
      !isValidMoment(this.state.until) ||
      date <= moment(this.state.until, MOMENT_FORMAT)
    );
  }

  isValidUntil(date) {
    return (
      !isValidMoment(this.state.since) ||
      date >= moment(this.state.since, MOMENT_FORMAT)
    );
  }

  toggleCalendar(key) {
    const nextState = {};
    if (key === 'showSinceCalendar') {
      nextState.showSinceCalendar = !this.state.showSinceCalendar;
      if (!this.state.showSinceCalendar) {
        nextState.showUntilCalendar = false;
      }
    } else if (key === 'showUntilCalendar') {
      nextState.showUntilCalendar = !this.state.showUntilCalendar;
      if (!this.state.showUntilCalendar) {
        nextState.showSinceCalendar = false;
      }
    }
    this.setState(nextState);
  }

  handleVisibleChange(visible) {
    if (visible) {
      this.props.onOpenDateFilterControl();
    } else {
      this.props.onCloseDateFilterControl();
    }
    this.setState({ popoverVisible: visible });
  }

  renderInput(props, key) {
    return (
      <FormGroup>
        <InputGroup bsSize="small">
          <FormControl
            {...props}
            type="text"
            onKeyPress={this.onEnter}
            onFocus={this.setTypeCustomStartEnd}
            onClick={() => {}}
          />
          <InputGroup.Button onClick={() => this.toggleCalendar(key)}>
            <Button>
              <i className="fa fa-calendar" />
            </Button>
          </InputGroup.Button>
        </InputGroup>
      </FormGroup>
    );
  }

  renderPopover() {
    const grainOptions = TIME_GRAIN_OPTIONS.map(grain => (
      <Select.Option
        key={grain}
        value={grain}
        active={grain === this.state.grain}
      >
        {grain}
      </Select.Option>
    ));
    const timeFrames = COMMON_TIME_FRAMES.map(timeFrame => {
      const nextState = getStateFromCommonTimeFrame(timeFrame);
      const timeRange = buildTimeRangeString(nextState.since, nextState.until);

      return (
        <TimeFramesStyles key={timeFrame}>
          <Tooltip
            id={`tooltip-${timeFrame}`}
            key={timeFrame}
            placement="right"
            title={formatTimeRange(timeRange, this.props.endpoints)}
          >
            <div style={{ display: 'inline-block' }}>
              <Radio
                key={timeFrame.replace(' ', '').toLowerCase()}
                checked={this.state.common === timeFrame}
                onChange={() => this.setState(nextState)}
              >
                {timeFrame}
              </Radio>
            </div>
          </Tooltip>
        </TimeFramesStyles>
      );
    });

    return (
      <PopoverContentStyles
        id="filter-popover"
        ref={ref => {
          this.popoverContainer = ref;
        }}
      >
        <Tabs
          defaultActiveKey={this.state.tab === TABS.DEFAULTS ? '1' : '2'}
          id="type"
          className="time-filter-tabs"
          onChange={this.changeTab}
        >
          <Tabs.TabPane key="1" tab="Defaults" forceRender>
            <div className="timeframes-container">
              <FormGroup>{timeFrames}</FormGroup>
            </div>
          </Tabs.TabPane>
          <Tabs.TabPane key="2" tab="Custom">
            <FormGroup>
              <PopoverSection
                title="Relative to today"
                isSelected={this.state.type === TYPES.CUSTOM_RANGE}
                onSelect={this.setTypeCustomRange}
              >
                <div className="relative-timerange-container clearfix centered">
                  <Select
                    value={this.state.rel}
                    onSelect={value => this.setCustomRange('rel', value)}
                    onFocus={this.setTypeCustomRange}
                  >
                    <Select.Option value={RELATIVE_TIME_OPTIONS.LAST}>
                      Last
                    </Select.Option>
                    <Select.Option value={RELATIVE_TIME_OPTIONS.NEXT}>
                      Next
                    </Select.Option>
                  </Select>
                  <Input
                    className="timerange-input"
                    type="text"
                    onChange={event =>
                      this.setCustomRange('num', event.target.value)
                    }
                    onFocus={this.setTypeCustomRange}
                    onPressEnter={this.close}
                    value={this.state.num}
                  />
                  <Select
                    value={this.state.grain}
                    onFocus={this.setTypeCustomRange}
                    onSelect={value => this.setCustomRange('grain', value)}
                    dropdownMatchSelectWidth={false}
                  >
                    {grainOptions}
                  </Select>
                </div>
              </PopoverSection>
              <PopoverSection
                title="Start / end"
                isSelected={this.state.type === TYPES.CUSTOM_START_END}
                onSelect={this.setTypeCustomStartEnd}
                info={FREEFORM_TOOLTIP}
              >
                <div
                  ref={ref => {
                    this.startEndSectionRef = ref;
                  }}
                >
                  <InputGroup data-test="date-input-group">
                    <Datetime
                      className="datetime"
                      inputProps={{ 'data-test': 'date-from-input' }}
                      value={this.state.since}
                      defaultValue={this.state.since}
                      viewDate={this.state.since}
                      onChange={value => this.setCustomStartEnd('since', value)}
                      isValidDate={this.isValidSince}
                      onClick={this.setTypeCustomStartEnd}
                      renderInput={props =>
                        this.renderInput(props, 'showSinceCalendar')
                      }
                      open={this.state.showSinceCalendar}
                      viewMode={this.state.sinceViewMode}
                      onViewModeChange={sinceViewMode =>
                        this.setState({ sinceViewMode })
                      }
                    />
                    <Datetime
                      className="datetime"
                      inputProps={{ 'data-test': 'date-to-input' }}
                      value={this.state.until}
                      defaultValue={this.state.until}
                      viewDate={this.state.until}
                      onChange={value => this.setCustomStartEnd('until', value)}
                      isValidDate={this.isValidUntil}
                      onClick={this.setTypeCustomStartEnd}
                      renderInput={props =>
                        this.renderInput(props, 'showUntilCalendar')
                      }
                      open={this.state.showUntilCalendar}
                      viewMode={this.state.untilViewMode}
                      onViewModeChange={untilViewMode =>
                        this.setState({ untilViewMode })
                      }
                    />
                  </InputGroup>
                </div>
              </PopoverSection>
            </FormGroup>
          </Tabs.TabPane>
        </Tabs>
        <div className="clearfix">
          <Button
            data-test="date-ok-button"
            buttonSize="small"
            className="float-right ok"
            buttonStyle="primary"
            onClick={this.close}
          >
            Ok
          </Button>
        </div>
      </PopoverContentStyles>
    );
  }

  render() {
    const timeRange = this.props.value || defaultProps.value;
    return (
      <div>
        <ControlHeader {...this.props} />
        <Popover
          trigger="click"
          placement="right"
          content={this.renderPopover()}
          visible={this.state.popoverVisible}
          onVisibleChange={this.handleVisibleChange}
        >
          <Label
            name="popover-trigger"
            className="pointer"
            data-test="popover-trigger"
          >
            {formatTimeRange(timeRange, this.props.endpoints)}
          </Label>
        </Popover>
      </div>
    );
  }
}

export default withTheme(DateFilterControl);

DateFilterControl.propTypes = propTypes;
DateFilterControl.defaultProps = defaultProps;
