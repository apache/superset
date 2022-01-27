import _isEqual from "lodash/isEqual";(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /* eslint-disable react/jsx-handler-names */
/* eslint-disable react/no-access-state-in-setstate */
/* eslint-disable camelcase */
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
import { SupersetClient } from '@superset-ui/core';

import { DeckGLContainerStyledWrapper } from '../DeckGLContainer';
import { getExploreLongUrl } from '../utils/explore';
import layerGenerators from '../layers';import { jsx as ___EmotionJSX } from "@emotion/react";

const propTypes = {
  formData: PropTypes.object.isRequired,
  payload: PropTypes.object.isRequired,
  setControlValue: PropTypes.func.isRequired,
  viewport: PropTypes.object.isRequired,
  onAddFilter: PropTypes.func,
  onSelect: PropTypes.func };

const defaultProps = {
  onAddFilter() {},
  onSelect() {} };


class DeckMulti extends React.PureComponent {


  constructor(props) {
    super(props);this.containerRef = /*#__PURE__*/React.createRef();this.


































































    setTooltip = (tooltip) => {
      const { current } = this.containerRef;
      if (current) {
        current.setTooltip(tooltip);
      }
    };this.state = { subSlicesLayers: {} };this.onViewportChange = this.onViewportChange.bind(this);}componentDidMount() {const { formData, payload } = this.props;this.loadLayers(formData, payload);}UNSAFE_componentWillReceiveProps(nextProps) {const { formData, payload } = nextProps;const hasChanges = !_isEqual(this.props.formData.deck_slices, nextProps.formData.deck_slices);if (hasChanges) {this.loadLayers(formData, payload);}}onViewportChange(viewport) {this.setState({ viewport });}loadLayers(formData, payload, viewport) {this.setState({ subSlicesLayers: {}, viewport });payload.data.slices.forEach((subslice) => {// Filters applied to multi_deck are passed down to underlying charts
      // note that dashboard contextual information (filter_immune_slices and such) aren't
      // taken into consideration here
      const filters = [...(subslice.form_data.filters || []), ...(formData.filters || []), ...(formData.extra_filters || [])];const subsliceCopy = { ...subslice, form_data: { ...subslice.form_data, filters } };SupersetClient.get({ endpoint: getExploreLongUrl(subsliceCopy.form_data, 'json') }).then(({ json }) => {const layer = layerGenerators[subsliceCopy.form_data.viz_type](subsliceCopy.form_data, json, this.props.onAddFilter, this.setTooltip, [], this.props.onSelect);this.setState({ subSlicesLayers: { ...this.state.subSlicesLayers, [subsliceCopy.slice_id]: layer } });}).catch(() => {});});}render() {const { payload, formData, setControlValue } = this.props;
    const { subSlicesLayers } = this.state;

    const layers = Object.values(subSlicesLayers);

    return (
      ___EmotionJSX(DeckGLContainerStyledWrapper, {
        ref: this.containerRef,
        mapboxApiAccessToken: payload.data.mapboxApiKey,
        viewport: this.state.viewport || this.props.viewport,
        layers: layers,
        mapStyle: formData.mapbox_style,
        setControlValue: setControlValue,
        onViewportChange: this.onViewportChange }));


  } // @ts-ignore
  __reactstandin__regenerateByEval(key, code) {// @ts-ignore
    this[key] = eval(code);}}
DeckMulti.propTypes = propTypes;
DeckMulti.defaultProps = defaultProps;const _default =

DeckMulti;export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(propTypes, "propTypes", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-deckgl/src/Multi/Multi.jsx");reactHotLoader.register(defaultProps, "defaultProps", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-deckgl/src/Multi/Multi.jsx");reactHotLoader.register(DeckMulti, "DeckMulti", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-deckgl/src/Multi/Multi.jsx");reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-deckgl/src/Multi/Multi.jsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();