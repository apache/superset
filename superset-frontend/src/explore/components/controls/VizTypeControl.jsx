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
import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Row, Col, FormControl } from 'react-bootstrap';
import { t, getChartMetadataRegistry } from '@superset-ui/core';
import { useDynamicPluginContext } from 'src/components/DynamicPlugins';
import { Tooltip } from 'src/common/components/Tooltip';
import Modal from 'src/common/components/Modal';
import Label from 'src/components/Label';

import ControlHeader from '../ControlHeader';
import './VizTypeControl.less';

const propTypes = {
  description: PropTypes.string,
  label: PropTypes.string,
  name: PropTypes.string.isRequired,
  onChange: PropTypes.func,
  value: PropTypes.string.isRequired,
  labelBsStyle: PropTypes.string,
};

const defaultProps = {
  onChange: () => {},
  labelBsStyle: 'default',
};

const registry = getChartMetadataRegistry();

const IMAGE_PER_ROW = 6;
const DEFAULT_ORDER = [
  'line',
  'big_number',
  'table',
  'filter_box',
  'dist_bar',
  'area',
  'bar',
  'deck_polygon',
  'pie',
  'time_table',
  'pivot_table',
  'histogram',
  'big_number_total',
  'deck_scatter',
  'deck_hex',
  'time_pivot',
  'deck_arc',
  'heatmap',
  'deck_grid',
  'dual_line',
  'deck_screengrid',
  'line_multi',
  'treemap',
  'box_plot',
  'sunburst',
  'sankey',
  'word_cloud',
  'mapbox',
  'kepler',
  'cal_heatmap',
  'rose',
  'bubble',
  'deck_geojson',
  'horizon',
  'deck_multi',
  'compare',
  'partition',
  'event_flow',
  'deck_path',
  'directed_force',
  'world_map',
  'paired_ttest',
  'para',
  'country_map',
];

const typesWithDefaultOrder = new Set(DEFAULT_ORDER);

function VizSupportValidation({ vizType }) {
  const state = useDynamicPluginContext();
  if (state.loading || registry.has(vizType)) {
    return null;
  }
  return (
    <div className="text-danger">
      <i className="fa fa-exclamation-circle text-danger" />{' '}
      <small>{t('This visualization type is not supported.')}</small>
    </div>
  );
}

const VizTypeControl = props => {
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState('');
  const searchRef = useRef(null);

  useEffect(() => {
    if (showModal) {
      searchRef?.current?.focus();
    }
  }, [showModal]);

  const onChange = vizType => {
    props.onChange(vizType);
    setShowModal(false);
  };

  const toggleModal = () => {
    setShowModal(prevState => !prevState);
  };

  const changeSearch = event => {
    setFilter(event.target.value);
  };

  const focusSearch = () => {
    if (searchRef) {
      searchRef.focus();
    }
  };

  const renderItem = entry => {
    const { value } = props;
    const { key, value: type } = entry;
    const isSelected = key === value;

    return (
      <div
        role="button"
        tabIndex={0}
        className={`viztype-selector-container ${isSelected ? 'selected' : ''}`}
        onClick={() => onChange(key)}
      >
        <img
          alt={type.name}
          width="100%"
          className={`viztype-selector ${isSelected ? 'selected' : ''}`}
          src={type.thumbnail}
        />
        <div className="viztype-label" data-test="viztype-label">
          {type.name}
        </div>
      </div>
    );
  };

  const { value, labelBsStyle } = props;
  const filterString = filter.toLowerCase();

  const filteredTypes = DEFAULT_ORDER.filter(type => registry.has(type))
    .filter(type => !registry.get(type).isNativeFilter)
    .map(type => ({
      key: type,
      value: registry.get(type),
    }))
    .concat(
      registry
        .entries()
        .filter(entry => !entry.value.isNativeFilter)
        .filter(({ key }) => !typesWithDefaultOrder.has(key)),
    )
    .filter(entry => entry.value.name.toLowerCase().includes(filterString));

  const rows = [];
  for (let i = 0; i <= filteredTypes.length; i += IMAGE_PER_ROW) {
    rows.push(
      <Row data-test="viz-row" key={`row-${i}`}>
        {filteredTypes.slice(i, i + IMAGE_PER_ROW).map(entry => (
          <Col md={12 / IMAGE_PER_ROW} key={`grid-col-${entry.key}`}>
            {renderItem(entry)}
          </Col>
        ))}
      </Row>,
    );
  }

  return (
    <div>
      <ControlHeader {...props} />
      <Tooltip
        id="error-tooltip"
        placement="right"
        title={t('Click to change visualization type')}
      >
        <>
          <Label onClick={toggleModal} bsStyle={labelBsStyle}>
            {registry.has(value) ? registry.get(value).name : `${value}`}
          </Label>
          <VizSupportValidation vizType={value} />
        </>
      </Tooltip>
      <Modal
        show={showModal}
        onHide={toggleModal}
        onEnter={focusSearch}
        title={t('Select a visualization type')}
        responsive
        hideFooter
        forceRender
      >
        <div className="viztype-control-search-box">
          <FormControl
            inputRef={ref => {
              searchRef.current = ref;
            }}
            type="text"
            value={filter}
            placeholder={t('Search')}
            onChange={changeSearch}
          />
        </div>
        {rows}
      </Modal>
    </div>
  );
};

VizTypeControl.propTypes = propTypes;
VizTypeControl.defaultProps = defaultProps;

export default VizTypeControl;
