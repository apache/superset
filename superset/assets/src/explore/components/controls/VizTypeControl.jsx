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
  Label, Row, Col, FormControl, Modal, OverlayTrigger,
  Tooltip } from 'react-bootstrap';
import { t } from '@superset-ui/translation';
import { getChartMetadataRegistry } from '@superset-ui/chart';

import ControlHeader from '../ControlHeader';
import './VizTypeControl.css';

const propTypes = {
  description: PropTypes.string,
  label: PropTypes.string,
  name: PropTypes.string.isRequired,
  onChange: PropTypes.func,
  value: PropTypes.string.isRequired,
};

const defaultProps = {
  onChange: () => {},
};

export default class VizTypeControl extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      showModal: false,
      filter: '',
    };
    this.toggleModal = this.toggleModal.bind(this);
    this.changeSearch = this.changeSearch.bind(this);
    this.setSearchRef = this.setSearchRef.bind(this);
    this.focusSearch = this.focusSearch.bind(this);
  }
  onChange(vizType) {
    this.props.onChange(vizType);
    this.setState({ showModal: false });
  }
  setSearchRef(searchRef) {
    this.searchRef = searchRef;
  }
  toggleModal() {
    this.setState({ showModal: !this.state.showModal });
  }
  changeSearch(event) {
    this.setState({ filter: event.target.value });
  }
  focusSearch() {
    if (this.searchRef) {
      this.searchRef.focus();
    }
  }
  renderItem(entry) {
    const { value } = this.props;
    const { key, value: type } = entry;
    const isSelected = key === value;
    return (
      <div
        className={`viztype-selector-container ${isSelected ? 'selected' : ''}`}
        onClick={this.onChange.bind(this, key)}
      >
        <img
          alt={type.name}
          width="100%"
          className={`viztype-selector ${isSelected ? 'selected' : ''}`}
          src={type.thumbnail}
        />
        <div className="viztype-label">
          {type.name}
        </div>
      </div>);
  }
  _buildVizTypeLookup(types) {
    let lookup = new Map()
    for (var i = 0; i < types.length; i++) {
      lookup.set(types[i].key, types[i]);
    }
    return lookup
  }
  _sortVizTypes(types) {
    const defaultOrder = [
      'line', 'big_number', 'table', 'filter_box', 'dist_bar', 'area', 'bar',
      'deck_polygon', 'pie', 'time_table', 'pivot_table', 'histogram',
      'big_number_total', 'deck_scatter', 'deck_hex', 'time_pivot', 'deck_arc',
      'heatmap', 'deck_grid', 'dual_line', 'deck_screengrid', 'line_multi',
      'treemap', 'box_plot', 'separator', 'sunburst', 'sankey', 'word_cloud',
      'mapbox', 'kepler', 'cal_heatmap', 'rose', 'bubble', 'deck_geojson',
      'horizon', 'markup', 'deck_multi', 'compare', 'partition', 'event_flow',
      'deck_path', 'directed_force', 'world_map', 'paired_ttest', 'para',
      'iframe', 'country_map',
    ]

    let sorted = [];
    let loadedKeys = new Set();
    let vizTypeLookup = this._buildVizTypeLookup(types);

    // Sort based on the `defualtOrder`
    for (var i = 0; i < defaultOrder.length; i++) {
      let key = defaultOrder[i];
      let t = vizTypeLookup.get(key);
      if (typeof t !== 'undefined') {
        sorted.push(t);
        loadedKeys.add(key);
      }
    }

    // Load the rest of Viz Types not mandated by the `defualtOrder`
    for (var i = 0; i < types.length; i++) {
      let t = types[i];
      let key = t['key'];
      if (! loadedKeys.has(key)) {
        sorted.push(t);
        loadedKeys.add(key);
      }
    }

    return sorted;
  }
  render() {
    const { filter, showModal } = this.state;
    const { value } = this.props;

    const registry = getChartMetadataRegistry();
    const types = this._sortVizTypes(registry.entries());
    const filteredTypes = filter.length > 0
      ? types.filter(type => type.value.name.toLowerCase().includes(filter))
      : types;

    const selectedType = registry.get(value);

    const imgPerRow = 6;
    const rows = [];
    for (let i = 0; i <= filteredTypes.length; i += imgPerRow) {
      rows.push(
        <Row key={`row-${i}`}>
          {filteredTypes.slice(i, i + imgPerRow).map(entry => (
            <Col md={12 / imgPerRow} key={`grid-col-${entry.key}`}>
              {this.renderItem(entry)}
            </Col>
          ))}
        </Row>);
    }
    return (
      <div>
        <ControlHeader
          {...this.props}
        />
        <OverlayTrigger
          placement="right"
          overlay={
            <Tooltip id={'error-tooltip'}>{t('Click to change visualization type')}</Tooltip>
          }
        >
          <Label onClick={this.toggleModal} style={{ cursor: 'pointer' }}>
            {selectedType.name}
          </Label>
        </OverlayTrigger>
        <Modal
          show={showModal}
          onHide={this.toggleModal}
          onEnter={this.focusSearch}
          onExit={this.setSearchRef}
          bsSize="lg"
        >
          <Modal.Header closeButton>
            <Modal.Title>{t('Select a visualization type')}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="viztype-control-search-box">
              <FormControl
                inputRef={this.setSearchRef}
                type="text"
                value={filter}
                placeholder={t('Search')}
                onChange={this.changeSearch}
              />
            </div>
            {rows}
          </Modal.Body>
        </Modal>
      </div>
    );
  }
}

VizTypeControl.propTypes = propTypes;
VizTypeControl.defaultProps = defaultProps;
