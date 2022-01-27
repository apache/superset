import _pt from "prop-types";import _isEqual from "lodash/isEqual";(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /**
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



import {
DeckGLContainerStyledWrapper } from

'./DeckGLContainer';
import CategoricalDeckGLContainer from './CategoricalDeckGLContainer';
import fitViewport from './utils/fitViewport';import { jsx as ___EmotionJSX } from "@emotion/react";




























export function createDeckGLComponent(
getLayer,
getPoints)
{
  // Higher order component
  class Component extends React.PureComponent


  {


    constructor(props) {
      super(props);this.containerRef = /*#__PURE__*/React.createRef();this.








































      setTooltip = (tooltip) => {
        const { current } = this.containerRef;
        if (current) {
          current == null ? void 0 : current.setTooltip(tooltip);
        }
      };const { width, height, formData } = props;let { viewport } = props;if (formData.autozoom) {viewport = fitViewport(viewport, { width, height, points: getPoints(props.payload.data.features) });}this.state = { viewport, layer: this.computeLayer(props) };this.onViewportChange = this.onViewportChange.bind(this);}UNSAFE_componentWillReceiveProps(nextProps) {// Only recompute the layer if anything BUT the viewport has changed
      const nextFdNoVP = { ...nextProps.formData, viewport: null };const currFdNoVP = { ...this.props.formData, viewport: null };if (!_isEqual(nextFdNoVP, currFdNoVP) || nextProps.payload !== this.props.payload) {this.setState({ layer: this.computeLayer(nextProps) });}}onViewportChange(viewport) {this.setState({ viewport });}computeLayer(props) {const { formData, payload, onAddFilter } = props;return getLayer(formData, payload, onAddFilter, this.setTooltip);}
    render() {
      const { formData, payload, setControlValue, height, width } = this.props;
      const { layer, viewport } = this.state;

      return (
        ___EmotionJSX(DeckGLContainerStyledWrapper, {
          ref: this.containerRef,
          mapboxApiAccessToken: payload.data.mapboxApiKey,
          viewport: viewport,
          layers: [layer],
          mapStyle: formData.mapbox_style,
          setControlValue: setControlValue,
          width: width,
          height: height,
          onViewportChange: this.onViewportChange }));


    } // @ts-ignore
    __reactstandin__regenerateByEval(key, code) {// @ts-ignore
      this[key] = eval(code);}}Component.propTypes = { height: _pt.number.isRequired, onAddFilter: _pt.func.isRequired, setControlValue: _pt.func.isRequired, width: _pt.number.isRequired };return Component;
}

export function createCategoricalDeckGLComponent(
getLayer,
getPoints)
{
  return function Component(props) {
    const {
      datasource,
      formData,
      height,
      payload,
      setControlValue,
      viewport,
      width } =
    props;

    return (
      ___EmotionJSX(CategoricalDeckGLContainer, {
        datasource: datasource,
        formData: formData,
        mapboxApiKey: payload.data.mapboxApiKey,
        setControlValue: setControlValue,
        viewport: viewport,
        getLayer: getLayer,
        payload: payload,
        getPoints: getPoints,
        width: width,
        height: height }));


  };
};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(createDeckGLComponent, "createDeckGLComponent", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-deckgl/src/factory.tsx");reactHotLoader.register(createCategoricalDeckGLComponent, "createCategoricalDeckGLComponent", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-deckgl/src/factory.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();