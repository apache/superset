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
import {
  Button,
  DropdownButton,
  FormControl,
  FormGroup,
  InputGroup,
  Label,
  MenuItem,
  OverlayTrigger,
  Popover,
  Radio,
  Tab,
  Tabs,
  Tooltip,
} from 'react-bootstrap';
import Datetime from 'react-datetime';
import 'react-datetime/css/react-datetime.css';
import moment from 'moment';
import { t } from '@superset-ui/translation';

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
  'Superset supports smart date parsing. Strings like `last sunday` or ' +
    '`last october` can be used.',
);

const DATE_FILTER_POPOVER_STYLE = { width: '250px' };

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
  return {
    tab: TABS.DEFAULTS,
    type: TYPES.DEFAULTS,
    common: value,
    since: moment()
      .utc()
      .startOf('day')
      .subtract(1, units)
      .format(MOMENT_FORMAT),
    until: moment().utc().startOf('day').format(MOMENT_FORMAT),
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

export default class DateFilterControl extends React.Component {
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
    };

    const value = props.value;
    if (value.indexOf(SEPARATOR) >= 0) {
      this.state = { ...this.state, ...getStateFromSeparator(value) };
    } else if (COMMON_TIME_FRAMES.indexOf(value) >= 0) {
      this.state = { ...this.state, ...getStateFromCommonTimeFrame(value) };
    } else {
      this.state = { ...this.state, ...getStateFromCustomRange(value) };
    }

    this.close = this.close.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleClickTrigger = this.handleClickTrigger.bind(this);
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
    this.setState({
      type: TYPES.CUSTOM_START_END,
      [key]: typeof value === 'string' ? value : value.format(MOMENT_FORMAT),
      showSinceCalendar: this.state.showSinceCalendar && !closeCalendar,
      showUntilCalendar: this.state.showUntilCalendar && !closeCalendar,
      sinceViewMode: closeCalendar ? 'days' : this.state.sinceViewMode,
      untilViewMode: closeCalendar ? 'days' : this.state.untilViewMode,
    });
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
    const target = e.target;
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

  handleClickTrigger() {
    // when user clicks OverlayTrigger,
    // popoverContainer component will be created after handleClickTrigger
    // and before handleClick handler
    if (!this.popoverContainer) {
      this.props.onOpenDateFilterControl();
    } else {
      this.props.onCloseDateFilterControl();
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
    this.refs.trigger.hide();
    this.setState({ showSinceCalendar: false, showUntilCalendar: false });
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
      <MenuItem
        onSelect={value => this.setCustomRange('grain', value)}
        key={grain}
        eventKey={grain}
        active={grain === this.state.grain}
      >
        {grain}
      </MenuItem>
    ));
    const timeFrames = COMMON_TIME_FRAMES.map(timeFrame => {
      const nextState = getStateFromCommonTimeFrame(timeFrame);
      const endpoints = this.props.endpoints;
      return (
        <OverlayTrigger
          key={timeFrame}
          placement="left"
          overlay={
            <Tooltip id={`tooltip-${timeFrame}`}>
              {nextState.since} {endpoints && `(${endpoints[0]})`}
              <br />
              {nextState.until} {endpoints && `(${endpoints[1]})`}
            </Tooltip>
          }
        >
          <div>
            <Radio
              key={timeFrame.replace(' ', '').toLowerCase()}
              checked={this.state.common === timeFrame}
              onChange={() => this.setState(nextState)}
            >
              {timeFrame}
            </Radio>
          </div>
        </OverlayTrigger>
      );
    });
    return (
      <Popover id="filter-popover" placement="top" positionTop={0}>
        <div
          style={DATE_FILTER_POPOVER_STYLE}
          ref={ref => {
            this.popoverContainer = ref;
          }}
        >
          <Tabs
            defaultActiveKey={this.state.tab === TABS.DEFAULTS ? 1 : 2}
            id="type"
            className="time-filter-tabs"
            onSelect={this.changeTab}
          >
            <Tab eventKey={1} title="Defaults">
              <FormGroup>{timeFrames}</FormGroup>
            </Tab>
            <Tab eventKey={2} title="Custom">
              <FormGroup>
                <PopoverSection
                  title="Relative to today"
                  isSelected={this.state.type === TYPES.CUSTOM_RANGE}
                  onSelect={this.setTypeCustomRange}
                >
                  <div
                    className="clearfix centered"
                    style={{ marginTop: '12px' }}
                  >
                    <div
                      style={{ width: '60px', marginTop: '-4px' }}
                      className="input-inline"
                    >
                      <DropdownButton
                        bsSize="small"
                        componentClass={InputGroup.Button}
                        id="input-dropdown-rel"
                        title={this.state.rel}
                        onFocus={this.setTypeCustomRange}
                      >
                        <MenuItem
                          onSelect={value => this.setCustomRange('rel', value)}
                          key={RELATIVE_TIME_OPTIONS.LAST}
                          eventKey={RELATIVE_TIME_OPTIONS.LAST}
                          active={this.state.rel === RELATIVE_TIME_OPTIONS.LAST}
                        >
                          Last
                        </MenuItem>
                        <MenuItem
                          onSelect={value => this.setCustomRange('rel', value)}
                          key={RELATIVE_TIME_OPTIONS.NEXT}
                          eventKey={RELATIVE_TIME_OPTIONS.NEXT}
                          active={this.state.rel === RELATIVE_TIME_OPTIONS.NEXT}
                        >
                          Next
                        </MenuItem>
                      </DropdownButton>
                    </div>
                    <div
                      style={{ width: '60px', marginTop: '-4px' }}
                      className="input-inline m-l-5 m-r-3"
                    >
                      <FormControl
                        bsSize="small"
                        type="text"
                        onChange={event =>
                          this.setCustomRange('num', event.target.value)
                        }
                        onFocus={this.setTypeCustomRange}
                        onKeyPress={this.onEnter}
                        value={this.state.num}
                        style={{ height: '30px' }}
                      />
                    </div>
                    <div
                      style={{ width: '90px', marginTop: '-4px' }}
                      className="input-inline"
                    >
                      <DropdownButton
                        bsSize="small"
                        componentClass={InputGroup.Button}
                        id="input-dropdown-grain"
                        title={this.state.grain}
                        onFocus={this.setTypeCustomRange}
                      >
                        {grainOptions}
                      </DropdownButton>
                    </div>
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
                    <InputGroup>
                      <div style={{ margin: '5px 0' }}>
                        <Datetime
                          value={this.state.since}
                          defaultValue={this.state.since}
                          viewDate={this.state.since}
                          onChange={value =>
                            this.setCustomStartEnd('since', value)
                          }
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
                      </div>
                      <div style={{ margin: '5px 0' }}>
                        <Datetime
                          value={this.state.until}
                          defaultValue={this.state.until}
                          viewDate={this.state.until}
                          onChange={value =>
                            this.setCustomStartEnd('until', value)
                          }
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
                      </div>
                    </InputGroup>
                  </div>
                </PopoverSection>
              </FormGroup>
            </Tab>
          </Tabs>
          <div className="clearfix">
            <Button
              bsSize="small"
              className="float-right ok"
              bsStyle="primary"
              onClick={this.close}
            >
              Ok
            </Button>
          </div>
        </div>
      </Popover>
    );
  }
  render() {
    let value = this.props.value || defaultProps.value;
    const endpoints = this.props.endpoints;
    value = value
      .split(SEPARATOR)
      .map(
        (v, idx, values) =>
          (v.replace('T00:00:00', '') || (idx === 0 ? '-∞' : '∞')) +
          (endpoints && values.length > 1 ? ` (${endpoints[idx]})` : ''),
      )
      .join(SEPARATOR);
    return (
      <div>
        <ControlHeader {...this.props} />
        <OverlayTrigger
          animation={this.props.animation}
          container={document.body}
          trigger="click"
          rootClose
          ref="trigger"
          placement="right"
          overlay={this.renderPopover()}
          onClick={this.handleClickTrigger}
        >
          <Label name="popover-trigger" style={{ cursor: 'pointer' }}>
            {value}
          </Label>
        </OverlayTrigger>
      </div>
    );
  }
}

DateFilterControl.propTypes = propTypes;
DateFilterControl.defaultProps = defaultProps;
