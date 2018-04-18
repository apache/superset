import React from 'react';
import PropTypes from 'prop-types';
import {
  Button,
  ButtonGroup,
  DropdownButton,
  Form,
  FormControl,
  FormGroup,
  Glyphicon,
  InputGroup,
  Label,
  MenuItem,
  OverlayTrigger,
  Popover,
  Radio,
  Tab,
  Tabs,
} from 'react-bootstrap';
import Select from 'react-select';
import Datetime from 'react-datetime';
import 'react-datetime/css/react-datetime.css';
import moment from 'moment';

import ControlHeader from '../ControlHeader';
import PopoverSection from '../../../components/PopoverSection';

const RELATIVE_TIME_OPTIONS = ['ago', 'from now'];
const TIME_GRAIN_OPTIONS = ['seconds', 'minutes', 'days', 'weeks', 'months', 'years'];

const propTypes = {
  animation: PropTypes.bool,
  name: PropTypes.string.isRequired,
  label: PropTypes.string,
  description: PropTypes.string,
  onChange: PropTypes.func,
  value: PropTypes.string,
  height: PropTypes.number,
};

const defaultProps = {
  animation: true,
  onChange: () => {},
  value: '',
};

export default class DateFilterControl extends React.Component {
  constructor(props) {
    super(props);
    const value = props.value || '';
    this.state = {
      num: '7',
      grain: 'days',
      rel: 'ago',
      dttm: '',
      type: 'free',
      free: '',
    };
    const words = value.split(' ');
    if (words.length >= 3 && RELATIVE_TIME_OPTIONS.indexOf(words[2]) >= 0) {
      this.state.num = words[0];
      this.state.grain = words[1];
      this.state.rel = words[2];
      this.state.type = 'rel';
    } else if (moment(value).isValid()) {
      this.state.dttm = value;
      this.state.type = 'fix';
    } else {
      this.state.free = value;
      this.state.type = 'free';
    }
  }
  onControlChange(target, opt) {
    this.setState({ [target]: opt.value });
  }
  onNumberChange(event) {
    this.setState({ num: event.target.value });
  }
  onFreeChange(event) {
    this.setState({ free: event.target.value });
  }
  setType(type) {
    this.setState({ type });
  }
  setValueAndClose(val) {
    this.setState({ type: 'free', free: val }, this.close);
  }
  setDatetime(dttm) {
    this.setState({ dttm: dttm.format().substring(0, 19) });
  }
  close() {
    let val;
    if (this.state.type === 'rel') {
      val = `${this.state.num} ${this.state.grain} ${this.state.rel}`;
    } else if (this.state.type === 'fix') {
      val = this.state.dttm;
    } else if (this.state.type === 'free') {
      val = this.state.free;
    }
    this.props.onChange(val);
    this.refs.trigger.hide();
  }
  renderPopover() {
    return (
      <Popover id="filter-popover">
        <div style={{ width: '250px' }}>
          <Tabs defaultActiveKey={1} id="uncontrolled-tab-example" bsStyle="pills">
            <Tab eventKey={1} title="Relative">
      <form>
              <FormGroup>
                <Radio name="relative">Yesterday</Radio>
                <Radio name="relative">Last week</Radio>
                <Radio name="relative">Last month</Radio>
                <Radio name="relative">Last year</Radio>
                <Radio name="relative">
                  <FormControl.Static>Last</FormControl.Static>
                  <FormControl type="text" />
                  <DropdownButton
                    componentClass={InputGroup.Button}
                    id="input-dropdown-addon"
                    title="Action"
                  >
                    <MenuItem key="1">seconds</MenuItem>
                    <MenuItem key="2">minutes</MenuItem>
                    <MenuItem key="3">hours</MenuItem>
                    <MenuItem key="4">days</MenuItem>
                    <MenuItem key="5">weeks</MenuItem>
                    <MenuItem key="6">months</MenuItem>
                    <MenuItem key="7">years</MenuItem>
                  </DropdownButton>
                </Radio>
              </FormGroup>
            </Tab>
            <Tab eventKey={2} title="Fixed/Freeform">
              <PopoverSection
                title="Fixed"
                isSelected={this.state.type === 'fix'}
                onSelect={this.setType.bind(this, 'fix')}
              >
                <InputGroup bsSize="small">
                  <InputGroup.Addon>
                    <Glyphicon glyph="calendar" />
                  </InputGroup.Addon>
                  <Datetime
                    inputProps={{ className: 'form-control input-sm' }}
                    dateFormat="YYYY-MM-DD"
                    defaultValue={this.state.dttm}
                    onFocus={this.setType.bind(this, 'fix')}
                    onChange={this.setDatetime.bind(this)}
                    timeFormat="h:mm:ss"
                  />
                </InputGroup>
              </PopoverSection>
              <PopoverSection
                title="Relative"
                isSelected={this.state.type === 'rel'}
                onSelect={this.setType.bind(this, 'rel')}
              >
                <div className="clearfix">
                  <div style={{ width: '50px' }} className="input-inline">
                    <FormControl
                      onFocus={this.setType.bind(this, 'rel')}
                      value={this.state.num}
                      onChange={this.onNumberChange.bind(this)}
                      bsSize="small"
                    />
                  </div>
                  <div style={{ width: '95px' }} className="input-inline">
                    <Select
                      onFocus={this.setType.bind(this, 'rel')}
                      value={this.state.grain}
                      clearable={false}
                      options={TIME_GRAIN_OPTIONS.map(s => ({ label: s, value: s }))}
                      onChange={this.onControlChange.bind(this, 'grain')}
                    />
                  </div>
                  <div style={{ width: '95px' }} className="input-inline">
                    <Select
                      value={this.state.rel}
                      onFocus={this.setType.bind(this, 'rel')}
                      clearable={false}
                      options={RELATIVE_TIME_OPTIONS.map(s => ({ label: s, value: s }))}
                      onChange={this.onControlChange.bind(this, 'rel')}
                    />
                  </div>
                </div>
              </PopoverSection>
              <PopoverSection
                title="Free form"
                isSelected={this.state.type === 'free'}
                onSelect={this.setType.bind(this, 'free')}
                info={
              'Superset supports smart date parsing. Strings like `last sunday` or ' +
              '`last october` can be used.'
                }
              >
                <FormControl
                  onFocus={this.setType.bind(this, 'free')}
                  value={this.state.free}
                  onChange={this.onFreeChange.bind(this)}
                  bsSize="small"
                />
              </PopoverSection>
              <div className="clearfix">
                <Button
                  bsSize="small"
                  className="float-left ok"
                  bsStyle="primary"
                  onClick={this.close.bind(this)}
                >
              Ok
            </Button>
                <ButtonGroup
                  className="float-right"
                >
                  <Button
                    bsSize="small"
                    className="now"
                    onClick={this.setValueAndClose.bind(this, 'now')}
                  >
                now
              </Button>
                  <Button
                    bsSize="small"
                    className="clear"
                    onClick={this.setValueAndClose.bind(this, '')}
                  >
                clear
              </Button>
                </ButtonGroup>
              </div>
            </Tab>
          </Tabs>
        </div>
      </Popover>
    );
  }
  render() {
    const value = this.props.value || '';
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
        >
          <Label style={{ cursor: 'pointer' }}>
            {value.replace('T00:00:00', '') || '∞'}
          </Label>
        </OverlayTrigger>
      </div>
    );
  }
}

DateFilterControl.propTypes = propTypes;
DateFilterControl.defaultProps = defaultProps;
