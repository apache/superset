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
import { Input, Row, Col } from 'src/common/components';
import { t, getChartMetadataRegistry } from '@superset-ui/core';
import { useDynamicPluginContext } from 'src/components/DynamicPlugins';
import Modal from 'src/components/Modal';
import { Tooltip } from 'src/components/Tooltip';
import Label from 'src/components/Label';
import ControlHeader from 'src/explore/components/ControlHeader';
import { nativeFilterGate } from 'src/dashboard/components/nativeFilters/utils';
import './VizTypeControl.less';

const propTypes = {
  description: PropTypes.string,
  label: PropTypes.string,
  name: PropTypes.string.isRequired,
  onChange: PropTypes.func,
  value: PropTypes.string.isRequired,
  labelType: PropTypes.string,
};

const defaultProps = {
  onChange: () => {},
  labelType: 'default',
};

const registry = getChartMetadataRegistry();

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
  'graph_chart',
  'world_map',
  'paired_ttest',
  'para',
  'country_map',
];

const typesWithDefaultOrder = new Set(DEFAULT_ORDER);

export const VIZ_TYPE_CONTROL_TEST_ID = 'viz-type-control';

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
      setTimeout(() => searchRef?.current?.focus(), 200);
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
        <div
          className="viztype-label"
          data-test={`${VIZ_TYPE_CONTROL_TEST_ID}__viztype-label`}
        >
          {type.name}
        </div>
      </div>
    );
  };

  const { value, labelType } = props;
  const filterString = filter.toLowerCase();
  const filterStringParts = filterString.split(' ');

  const a = DEFAULT_ORDER.filter(type => registry.has(type));
  const filteredTypes = a
    .filter(type => {
      const behaviors = registry.get(type)?.behaviors || [];
      return nativeFilterGate(behaviors);
    })
    .map(type => ({
      key: type,
      value: registry.get(type),
    }))
    .concat(
      registry
        .entries()
        .filter(entry => {
          const behaviors = entry.value?.behaviors || [];
          return nativeFilterGate(behaviors);
        })
        .filter(({ key }) => !typesWithDefaultOrder.has(key)),
    )
    .filter(entry =>
      filterStringParts.every(
        part => entry.value.name.toLowerCase().indexOf(part) !== -1,
      ),
    );

  return (
    <div>
      <ControlHeader {...props} />
      <Tooltip
        id="error-tooltip"
        placement="right"
        title={t('Click to change visualization type')}
      >
        <>
          <Label
            onClick={toggleModal}
            type={labelType}
            data-test="visualization-type"
          >
            {registry.has(value) ? registry.get(value).name : `${value}`}
          </Label>
          <VizSupportValidation vizType={value} />
        </>
      </Tooltip>
      <Modal
        show={showModal}
        onHide={toggleModal}
        title={t('Select a visualization type')}
        responsive
        hideFooter
        forceRender
      >
        <div className="viztype-control-search-box">
          <Input
            ref={searchRef}
            type="text"
            value={filter}
            placeholder={t('Search')}
            onChange={changeSearch}
            data-test={`${VIZ_TYPE_CONTROL_TEST_ID}__search-input`}
          />
        </div>
        <Row data-test={`${VIZ_TYPE_CONTROL_TEST_ID}__viz-row`} gutter={16}>
          {filteredTypes.map(entry => (
            <Col xs={12} sm={8} md={6} lg={4} key={`grid-col-${entry.key}`}>
              {renderItem(entry)}
            </Col>
          ))}
        </Row>
      </Modal>
    </div>
  );
};

VizTypeControl.propTypes = propTypes;
VizTypeControl.defaultProps = defaultProps;

export default VizTypeControl;
