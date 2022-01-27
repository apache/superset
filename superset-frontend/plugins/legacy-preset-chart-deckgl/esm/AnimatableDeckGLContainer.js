(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /* eslint-disable react/jsx-sort-default-props */
/* eslint-disable react/sort-prop-types */
/* eslint-disable react/forbid-prop-types */
/* eslint-disable react/require-default-props */
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

import { DeckGLContainerStyledWrapper } from './DeckGLContainer';
import PlaySlider from './components/PlaySlider';import { jsx as ___EmotionJSX } from "@emotion/react";

const PLAYSLIDER_HEIGHT = 20; // px

const propTypes = {
  getLayers: PropTypes.func.isRequired,
  start: PropTypes.number.isRequired,
  end: PropTypes.number.isRequired,
  getStep: PropTypes.func,
  values: PropTypes.array.isRequired,
  aggregation: PropTypes.bool,
  disabled: PropTypes.bool,
  viewport: PropTypes.object.isRequired,
  children: PropTypes.node,
  mapStyle: PropTypes.string,
  mapboxApiAccessToken: PropTypes.string.isRequired,
  setControlValue: PropTypes.func,
  onValuesChange: PropTypes.func,
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired };


const defaultProps = {
  aggregation: false,
  disabled: false,
  mapStyle: 'light',
  setControlValue: () => {},
  onValuesChange: () => {} };


export default class AnimatableDeckGLContainer extends React.PureComponent {constructor(...args) {super(...args);this.
    containerRef = /*#__PURE__*/React.createRef();this.

    setTooltip = (tooltip) => {
      const { current } = this.containerRef;
      if (current) {
        current.setTooltip(tooltip);
      }
    };}

  render() {
    const {
      start,
      end,
      getStep,
      disabled,
      aggregation,
      children,
      getLayers,
      values,
      onValuesChange,
      viewport,
      setControlValue,
      mapStyle,
      mapboxApiAccessToken,
      height,
      width } =
    this.props;
    const layers = getLayers(values);

    return (
      ___EmotionJSX("div", null,
      ___EmotionJSX(DeckGLContainerStyledWrapper, {
        ref: this.containerRef,
        viewport: viewport,
        layers: layers,
        setControlValue: setControlValue,
        mapStyle: mapStyle,
        mapboxApiAccessToken: mapboxApiAccessToken,
        bottomMargin: disabled ? 0 : PLAYSLIDER_HEIGHT,
        width: width,
        height: height }),

      !disabled &&
      ___EmotionJSX(PlaySlider, {
        start: start,
        end: end,
        step: getStep(start),
        values: values,
        range: !aggregation,
        onChange: onValuesChange }),


      children));


  } // @ts-ignore
  __reactstandin__regenerateByEval(key, code) {// @ts-ignore
    this[key] = eval(code);}}
AnimatableDeckGLContainer.propTypes = propTypes;
AnimatableDeckGLContainer.defaultProps = defaultProps;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(PLAYSLIDER_HEIGHT, "PLAYSLIDER_HEIGHT", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-deckgl/src/AnimatableDeckGLContainer.jsx");reactHotLoader.register(propTypes, "propTypes", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-deckgl/src/AnimatableDeckGLContainer.jsx");reactHotLoader.register(defaultProps, "defaultProps", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-deckgl/src/AnimatableDeckGLContainer.jsx");reactHotLoader.register(AnimatableDeckGLContainer, "AnimatableDeckGLContainer", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-deckgl/src/AnimatableDeckGLContainer.jsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();