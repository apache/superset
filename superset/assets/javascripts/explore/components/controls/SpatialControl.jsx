import React from 'react';
import PropTypes from 'prop-types';
import {
  Row, Col, Button, FormControl, Label, OverlayTrigger, Popover,
} from 'react-bootstrap';
import 'react-datetime/css/react-datetime.css';

import ControlHeader from '../ControlHeader';
import SelectControl from './SelectControl';
import PopoverSection from '../../../components/PopoverSection';
import Checkbox from '../../../components/Checkbox';
import { t } from '../../../locales';

const spatialTypes = {
  latlong: 'latlong',
  delimited: 'delimited',
  geohash: 'geohash',
};

const propTypes = {
  onChange: PropTypes.func,
  value: PropTypes.object,
  animation: PropTypes.bool,
  choices: PropTypes.array,
};

const defaultProps = {
  onChange: () => {},
  animation: true,
  choices: [],
};

export default class SpatialControl extends React.Component {
  constructor(props) {
    super(props);
    const v = props.value || {};
    let defaultCol;
    if (props.choices.length > 0) {
      defaultCol = props.choices[0][0];
    }
    this.state = {
      type: v.type || spatialTypes.latlong,
      delimiter: v.delimiter || ',',
      latCol: v.latCol || defaultCol,
      lonCol: v.lonCol || defaultCol,
      lonlatCol: v.lonlatCol || defaultCol,
      reverseCheckbox: v.reverseCheckbox || false,
      geohashCol: v.geohashCol || defaultCol,
      value: null,
      errors: [],
    };
    this.onDelimiterChange = this.onDelimiterChange.bind(this);
    this.toggleCheckbox = this.toggleCheckbox.bind(this);
    this.onChange = this.onChange.bind(this);
  }
  componentDidMount() {
    this.onChange();
  }
  onChange() {
    const type = this.state.type;
    const value = { type };
    const errors = [];
    const errMsg = t('Invalid lat/long configuration.');
    if (type === spatialTypes.latlong) {
      value.latCol = this.state.latCol;
      value.lonCol = this.state.lonCol;
      if (!value.lonCol || !value.latCol) {
        errors.push(errMsg);
      }
    } else if (type === spatialTypes.delimited) {
      value.lonlatCol = this.state.lonlatCol;
      value.delimiter = this.state.delimiter;
      value.reverseCheckbox = this.state.reverseCheckbox;
      if (!value.lonlatCol || !value.delimiter) {
        errors.push(errMsg);
      }
    } else if (type === spatialTypes.geohash) {
      value.geohashCol = this.state.geohashCol;
      if (!value.geohashCol) {
        errors.push(errMsg);
      }
    }
    this.setState({ value, errors });
    this.props.onChange(value, errors);
  }
  onDelimiterChange(event) {
    this.setState({ delimiter: event.target.value }, this.onChange);
  }
  setType(type) {
    this.setState({ type }, this.onChange);
  }
  close() {
    this.refs.trigger.hide();
  }
  toggleCheckbox() {
    this.setState({ reverseCheckbox: !this.state.reverseCheckbox }, this.onChange);
  }
  renderLabelContent() {
    if (this.state.errors.length > 0) {
      return 'N/A';
    }
    if (this.state.type === spatialTypes.latlong) {
      return `${this.state.lonCol} | ${this.state.latCol}`;
    } else if (this.state.type === spatialTypes.delimited) {
      return `${this.state.lonlatCol}`;
    } else if (this.state.type === spatialTypes.geohash) {
      return `${this.state.geohashCol}`;
    }
    return null;
  }
  renderSelect(name, type) {
    return (
      <SelectControl
        name={name}
        choices={this.props.choices}
        value={this.state[name]}
        clearable={false}
        onFocus={() => {
          this.setType(type);
        }}
        onChange={(value) => {
          this.setState({ [name]: value }, this.onChange);
        }}
      />
    );
  }
  renderPopover() {
    return (
      <Popover id="filter-popover">
        <div style={{ width: '300px' }}>
          <PopoverSection
            title="Longitude & Latitude columns"
            isSelected={this.state.type === spatialTypes.latlong}
            onSelect={this.setType.bind(this, spatialTypes.latlong)}
          >
            <Row>
              <Col md={6}>
                Longitude
                {this.renderSelect('lonCol', spatialTypes.latlong)}
              </Col>
              <Col md={6}>
                Latitude
                {this.renderSelect('latCol', spatialTypes.latlong)}
              </Col>
            </Row>
          </PopoverSection>
          <PopoverSection
            title="Delimited long & lat single column"
            isSelected={this.state.type === spatialTypes.delimited}
            onSelect={this.setType.bind(this, spatialTypes.delimited)}
          >
            <Row>
              <Col md={6}>
                Column
                {this.renderSelect('lonlatCol', spatialTypes.delimited)}
              </Col>
              <Col md={6}>
                Delimiter
                <FormControl
                  onFocus={this.setType.bind(this, spatialTypes.delimited)}
                  value={this.state.delimiter}
                  onChange={this.onDelimiterChange}
                  placeholder="delimiter"
                  bsSize="small"
                />
              </Col>
            </Row>
            <div>
              {t('Reverse lat/long ')}
              <Checkbox checked={this.state.reverseCheckbox} onChange={this.toggleCheckbox} />
            </div>
          </PopoverSection>
          <PopoverSection
            title="Geohash"
            isSelected={this.state.type === spatialTypes.geohash}
            onSelect={this.setType.bind(this, spatialTypes.geohash)}
          >
            <Row>
              <Col md={6}>
                Column
                {this.renderSelect('geohashCol', spatialTypes.geohash)}
              </Col>
            </Row>
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
          </div>
        </div>
      </Popover>
    );
  }
  render() {
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
            {this.renderLabelContent()}
          </Label>
        </OverlayTrigger>
      </div>
    );
  }
}

SpatialControl.propTypes = propTypes;
SpatialControl.defaultProps = defaultProps;
