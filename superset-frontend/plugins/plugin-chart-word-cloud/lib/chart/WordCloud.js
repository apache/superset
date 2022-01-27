import _pt from "prop-types";(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /*
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
import cloudLayout from 'd3-cloud';
import {

createEncoderFactory } from


'encodable';
import { withTheme, seedRandom } from '@superset-ui/core';import { jsx as ___EmotionJSX } from "@emotion/react";

export const ROTATION = {
  flat: () => 0,
  // this calculates a random rotation between -90 and 90 degrees.
  random: () => Math.floor(seedRandom() * 6 - 3) * 30,
  square: () => Math.floor(seedRandom() * 2) * 90 };

































const defaultProps = {
  encoding: {},
  rotation: 'flat' };






const SCALE_FACTOR_STEP = 0.5;
const MAX_SCALE_FACTOR = 3;
// Percentage of top results that will always be displayed.
// Needed to avoid clutter when shrinking a chart with many records.
const TOP_RESULTS_PERCENTAGE = 0.1;

class WordCloud extends React.PureComponent


{


  // Cannot name it isMounted because of conflict
  // with React's component function name





















  constructor(props) {
    super(props);this.isComponentMounted = false;this.wordCloudEncoderFactory = createEncoderFactory({ channelTypes: { color: 'Color', fontFamily: 'Category', fontSize: 'Numeric', fontWeight: 'Category', text: 'Text' }, defaultEncoding: { color: { value: 'black' }, fontFamily: { value: this.props.theme.typography.families.sansSerif }, fontSize: { value: 20 }, fontWeight: { value: 'bold' }, text: { value: '' } } });this.createEncoder = this.wordCloudEncoderFactory.createSelector();
    this.state = {
      words: [],
      scaleFactor: 1 };

    this.setWords = this.setWords.bind(this);
  }

  componentDidMount() {
    this.isComponentMounted = true;
    this.update();
  }

  componentDidUpdate(prevProps) {
    const { data, encoding, width, height, rotation } = this.props;

    if (
    prevProps.data !== data ||
    prevProps.encoding !== encoding ||
    prevProps.width !== width ||
    prevProps.height !== height ||
    prevProps.rotation !== rotation)
    {
      this.update();
    }
  }

  componentWillUnmount() {
    this.isComponentMounted = false;
  }

  setWords(words) {
    if (this.isComponentMounted) {
      this.setState({ words });
    }
  }

  update() {
    const { data, encoding } = this.props;

    const encoder = this.createEncoder(encoding);
    encoder.setDomainFromDataset(data);

    const sortedData = [...data].sort(
    (a, b) =>
    encoder.channels.fontSize.encodeDatum(b, 0) -
    encoder.channels.fontSize.encodeDatum(a, 0));

    const topResultsCount = Math.max(
    sortedData.length * TOP_RESULTS_PERCENTAGE,
    10);

    const topResults = sortedData.slice(0, topResultsCount);

    // Ensure top results are always included in the final word cloud by scaling chart down if needed
    this.generateCloud(encoder, 1, (words) =>
    topResults.every((d) =>
    words.find(
    ({ text }) => encoder.channels.text.getValueFromDatum(d) === text)));



  }

  generateCloud(
  encoder,
  scaleFactor,
  isValid)
  {
    const { data, width, height, rotation } = this.props;

    cloudLayout().
    size([width * scaleFactor, height * scaleFactor])
    // clone the data because cloudLayout mutates input
    .words(data.map((d) => ({ ...d }))).
    padding(5).
    rotate(ROTATION[rotation] || ROTATION.flat).
    text((d) => encoder.channels.text.getValueFromDatum(d)).
    font((d) =>
    encoder.channels.fontFamily.encodeDatum(
    d,
    this.props.theme.typography.families.sansSerif)).


    fontWeight((d) => encoder.channels.fontWeight.encodeDatum(d, 'normal')).
    fontSize((d) => encoder.channels.fontSize.encodeDatum(d, 0)).
    on('end', (words) => {
      if (isValid(words) || scaleFactor > MAX_SCALE_FACTOR) {
        if (this.isComponentMounted) {
          this.setState({ words, scaleFactor });
        }
      } else {
        this.generateCloud(encoder, scaleFactor + SCALE_FACTOR_STEP, isValid);
      }
    }).
    start();
  }

  render() {
    const { scaleFactor } = this.state;
    const { width, height, encoding } = this.props;
    const { words } = this.state;

    const encoder = this.createEncoder(encoding);
    encoder.channels.color.setDomainFromDataset(words);

    const viewBoxWidth = width * scaleFactor;
    const viewBoxHeight = height * scaleFactor;

    return (
      ___EmotionJSX("svg", {
        width: width,
        height: height,
        viewBox: `-${viewBoxWidth / 2} -${
        viewBoxHeight / 2
        } ${viewBoxWidth} ${viewBoxHeight}` },

      ___EmotionJSX("g", null,
      words.map((w) =>
      ___EmotionJSX("text", {
        key: w.text,
        fontSize: `${w.size}px`,
        fontWeight: w.weight,
        fontFamily: w.font,
        fill: encoder.channels.color.encodeDatum(w, ''),
        textAnchor: "middle",
        transform: `translate(${w.x}, ${w.y}) rotate(${w.rotate})` },

      w.text)))));





  } // @ts-ignore
  __reactstandin__regenerateByEval(key, code) {// @ts-ignore
    this[key] = eval(code);}}WordCloud.propTypes = { rotation: _pt.any, data: _pt.array.isRequired, height: _pt.number.isRequired, width: _pt.number.isRequired };WordCloud.defaultProps = defaultProps;const _default =
withTheme(WordCloud);export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(ROTATION, "ROTATION", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-word-cloud/src/chart/WordCloud.tsx");reactHotLoader.register(defaultProps, "defaultProps", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-word-cloud/src/chart/WordCloud.tsx");reactHotLoader.register(SCALE_FACTOR_STEP, "SCALE_FACTOR_STEP", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-word-cloud/src/chart/WordCloud.tsx");reactHotLoader.register(MAX_SCALE_FACTOR, "MAX_SCALE_FACTOR", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-word-cloud/src/chart/WordCloud.tsx");reactHotLoader.register(TOP_RESULTS_PERCENTAGE, "TOP_RESULTS_PERCENTAGE", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-word-cloud/src/chart/WordCloud.tsx");reactHotLoader.register(WordCloud, "WordCloud", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-word-cloud/src/chart/WordCloud.tsx");reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-word-cloud/src/chart/WordCloud.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();