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

import React, { PureComponent } from 'react';
import { isDefined } from '../utils';import { jsx as ___EmotionJSX } from "@emotion/react";

function checkNumber(input) {
  return isDefined(input) && typeof input === 'number';
}















export default class ChartFrame extends PureComponent {




  render() {
    const { contentWidth, contentHeight, width, height, renderContent } =
    this.props;

    const overflowX = checkNumber(contentWidth) && contentWidth > width;
    const overflowY = checkNumber(contentHeight) && contentHeight > height;

    if (overflowX || overflowY) {
      return (
        ___EmotionJSX("div", {
          style: {
            height,
            overflowX: overflowX ? 'auto' : 'hidden',
            overflowY: overflowY ? 'auto' : 'hidden',
            width } },


        renderContent({
          height: Math.max(contentHeight != null ? contentHeight : 0, height),
          width: Math.max(contentWidth != null ? contentWidth : 0, width) })));



    }

    return renderContent({ height, width });
  } // @ts-ignore
  __reactstandin__regenerateByEval(key, code) {// @ts-ignore
    this[key] = eval(code);}}ChartFrame.propTypes = { contentWidth: _pt.number, contentHeight: _pt.number, height: _pt.number.isRequired, renderContent: _pt.func.isRequired, width: _pt.number.isRequired };ChartFrame.defaultProps = { renderContent() {} };;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(checkNumber, "checkNumber", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/chart-composition/ChartFrame.tsx");reactHotLoader.register(ChartFrame, "ChartFrame", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/chart-composition/ChartFrame.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();