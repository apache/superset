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
import { Row, Col, OverlayTrigger, Popover } from 'react-bootstrap';
import Button from 'src/components/Button';
import { t } from '@superset-ui/core';

import Label from 'src/components/Label';
import ControlHeader from '../ControlHeader';
import SelectControl from './SelectControl';
import PopoverSection from '../../../components/PopoverSection';
import Checkbox from '../../../components/Checkbox';

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
    this.toggleCheckbox = this.toggleCheckbox.bind(this);
    this.onChange = this.onChange.bind(this);
    this.renderReverseCheckbox = this.renderReverseCheckbox.bind(this);
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
      value.reverseCheckbox = this.state.reverseCheckbox;
      if (!value.geohashCol) {
        errors.push(errMsg);
      }
    }
    this.setState({ value, errors });
    this.props.onChange(value, errors);
  }
  setType(type) {
    this.setState({ type }, this.onChange);
  }
  close() {
    this.refs.trigger.hide();
  }
  toggleCheckbox() {
    this.setState(
      { reverseCheckbox: !this.state.reverseCheckbox },
      this.onChange,
    );
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
        onChange={value => {
          this.setState({ [name]: value }, this.onChange);
        }}
      />
    );
  }
  renderReverseCheckbox() {
    return (
      <span>
        {t('Reverse lat/long ')}
        <Checkbox
          checked={this.state.reverseCheckbox}
          onChange={this.toggleCheckbox}
        />
      </span>
    );
  }
  renderPopover() {
    return (
      <Popover id="filter-popover">
        <div style={{ width: '300px' }}>
          <PopoverSection
            title={t('Longitude & Latitude columns')}
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
            title={t('Delimited long & lat single column')}
            info={t(
              'Multiple formats accepted, look the geopy.points ' +
                'Python library for more details',
            )}
            isSelected={this.state.type === spatialTypes.delimited}
            onSelect={this.setType.bind(this, spatialTypes.delimited)}
          >
            <Row>
              <Col md={6}>
                {t('Column')}
                {this.renderSelect('lonlatCol', spatialTypes.delimited)}
              </Col>
              <Col md={6}>{this.renderReverseCheckbox()}</Col>
            </Row>
          </PopoverSection>
          <PopoverSection
            title={t('Geohash')}
            isSelected={this.state.type === spatialTypes.geohash}
            onSelect={this.setType.bind(this, spatialTypes.geohash)}
          >
            <Row>
              <Col md={6}>
                Column
                {this.renderSelect('geohashCol', spatialTypes.geohash)}
              </Col>
              <Col md={6}>{this.renderReverseCheckbox()}</Col>
            </Row>
          </PopoverSection>
          <div className="clearfix">
            <Button
              buttonSize="small"
              className="float-left ok"
              buttonStyle="primary"
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
          <Label className="pointer">{this.renderLabelContent()}</Label>
        </OverlayTrigger>
      </div>
    );
  }
}

SpatialControl.propTypes = propTypes;
SpatialControl.defaultProps = defaultProps;
