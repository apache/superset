import _extends from "@babel/runtime-corejs3/helpers/extends";(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /*
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

import React from 'react';import { jsx as ___EmotionJSX } from "@emotion/react";



export default function createTickComponent({
  axisWidth,
  labelAngle,
  labelFlush,
  labelOverlap,
  orient,
  tickLabels,
  tickLabelDimensions,
  tickTextAnchor = 'middle' })
{
  if (labelOverlap === 'rotate' && labelAngle !== 0) {
    let xOffset = labelAngle > 0 ? -6 : 6;
    if (orient === 'top') {
      xOffset = 0;
    }
    const yOffset = orient === 'top' ? -3 : 0;

    return ({
      x,
      y,
      formattedValue = '',
      ...textStyle }) =>







    ___EmotionJSX("g", { transform: `translate(${x + xOffset}, ${y + yOffset})` },
    ___EmotionJSX("text", _extends({
      transform: `rotate(${labelAngle})` },
    textStyle, {
      textAnchor: tickTextAnchor }),

    formattedValue));



  }

  if (labelFlush === true || typeof labelFlush === 'number') {
    const labelToDimensionMap = new Map();
    tickLabels.forEach((label, i) => {
      labelToDimensionMap.set(label, tickLabelDimensions[i]);
    });

    return ({
      x,
      y,
      formattedValue = '',
      ...textStyle }) =>






    {
      const dimension = labelToDimensionMap.get(formattedValue);
      const labelWidth = typeof dimension === 'undefined' ? 0 : dimension.width;
      let textAnchor = tickTextAnchor;
      let xOffset = 0;

      if (x - labelWidth / 2 < 0) {
        textAnchor = 'start';
        if (typeof labelFlush === 'number') {
          xOffset -= labelFlush;
        }
      } else if (x + labelWidth / 2 > axisWidth) {
        textAnchor = 'end';
        if (typeof labelFlush === 'number') {
          xOffset += labelFlush;
        }
      }

      return (
        ___EmotionJSX("text", _extends({ x: x + xOffset, y: y }, textStyle, { textAnchor: textAnchor }),
        formattedValue));


    };
  }

  // This will render the tick as horizontal string.
  return null;
};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(createTickComponent, "createTickComponent", "/Users/evan/GitHub/superset/superset-frontend/plugins/preset-chart-xy/src/utils/createTickComponent.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();