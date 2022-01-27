import _extends from "@babel/runtime-corejs3/helpers/extends";import _pt from "prop-types";(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /*
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

/* eslint-disable react/jsx-sort-default-props */
import * as React from 'react';
import { createSelector } from 'reselect';
import getChartComponentRegistry from '../registries/ChartComponentRegistrySingleton';
import getChartTransformPropsRegistry from '../registries/ChartTransformPropsRegistrySingleton';
import ChartProps from '../models/ChartProps';
import createLoadableRenderer from './createLoadableRenderer';import { jsx as ___EmotionJSX } from "@emotion/react";








function IDENTITY(x) {
  return x;
}

const EMPTY = () => null;

const defaultProps = {
  id: '',
  className: '',
  preTransformProps: IDENTITY,
  overrideTransformProps: undefined,
  postTransformProps: IDENTITY,
  onRenderSuccess() {},
  onRenderFailure() {} };

















const BLANK_CHART_PROPS = new ChartProps();













export default class SuperChartCore extends React.PureComponent {constructor(...args) {super(...args);this.



    container = void 0;this.











    processChartProps = createSelector(
    (input) =>




    input.chartProps,
    (input) => input.preTransformProps,
    (input) => input.transformProps,
    (input) => input.postTransformProps,
    (chartProps, pre = IDENTITY, transform = IDENTITY, post = IDENTITY) =>
    post(transform(pre(chartProps))));this.










    createLoadableRenderer = createSelector(
    (input) =>
    input.chartType,
    (input) => input.overrideTransformProps,
    (chartType, overrideTransformProps) => {
      if (chartType) {
        const Renderer = createLoadableRenderer({
          loader: {
            Chart: () => getChartComponentRegistry().getAsPromise(chartType),
            transformProps: overrideTransformProps ?
            () => Promise.resolve(overrideTransformProps) :
            () => getChartTransformPropsRegistry().getAsPromise(chartType) },

          loading: (loadingProps) =>
          this.renderLoading(loadingProps, chartType),
          render: this.renderChart });


        // Trigger preloading.
        Renderer.preload();

        return Renderer;
      }

      return EMPTY;
    });this.




    renderChart = (loaded, props) => {
      const { Chart, transformProps } = loaded;
      const { chartProps, preTransformProps, postTransformProps } = props;

      return (
        ___EmotionJSX(Chart,
        this.processChartProps({
          chartProps,
          preTransformProps,
          transformProps,
          postTransformProps })));



    };this.

    renderLoading = (loadingProps, chartType) => {
      const { error } = loadingProps;

      if (error) {
        return (
          ___EmotionJSX("div", { className: "alert alert-warning", role: "alert" },
          ___EmotionJSX("strong", null, "ERROR"), "\xA0",
          ___EmotionJSX("code", null, "chartType=\"", chartType, "\""), " \u2014",
          error.toString()));


      }

      return null;
    };this.

    setRef = (container) => {
      this.container = container;
    };}

  render() {
    const {
      id,
      className,
      preTransformProps,
      postTransformProps,
      chartProps = BLANK_CHART_PROPS,
      onRenderSuccess,
      onRenderFailure } =
    this.props;

    // Create LoadableRenderer and start preloading
    // the lazy-loaded Chart components
    const Renderer = this.createLoadableRenderer(this.props);

    // Do not render if chartProps is set to null.
    // but the pre-loading has been started in this.createLoadableRenderer
    // to prepare for rendering once chartProps becomes available.
    if (chartProps === null) {
      return null;
    }

    const containerProps =


    {};
    if (id) {
      containerProps.id = id;
    }
    if (className) {
      containerProps.className = className;
    }

    return (
      ___EmotionJSX("div", _extends({}, containerProps, { ref: this.setRef }),
      ___EmotionJSX(Renderer, {
        preTransformProps: preTransformProps,
        postTransformProps: postTransformProps,
        chartProps: chartProps,
        onRenderSuccess: onRenderSuccess,
        onRenderFailure: onRenderFailure })));



  } // @ts-ignore
  __reactstandin__regenerateByEval(key, code) {// @ts-ignore
    this[key] = eval(code);}}SuperChartCore.propTypes = { id: _pt.string, className: _pt.string, chartType: _pt.string.isRequired };SuperChartCore.defaultProps = defaultProps;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(IDENTITY, "IDENTITY", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/chart/components/SuperChartCore.tsx");reactHotLoader.register(EMPTY, "EMPTY", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/chart/components/SuperChartCore.tsx");reactHotLoader.register(defaultProps, "defaultProps", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/chart/components/SuperChartCore.tsx");reactHotLoader.register(BLANK_CHART_PROPS, "BLANK_CHART_PROPS", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/chart/components/SuperChartCore.tsx");reactHotLoader.register(SuperChartCore, "SuperChartCore", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/chart/components/SuperChartCore.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();