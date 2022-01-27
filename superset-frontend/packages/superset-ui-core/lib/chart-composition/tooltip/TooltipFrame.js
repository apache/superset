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

import React, { PureComponent } from 'react';import { jsx as ___EmotionJSX } from "@emotion/react";

const defaultProps = {
  className: '' };







const CONTAINER_STYLE = { padding: 8 };

class TooltipFrame extends PureComponent {


  render() {
    const { className, children } = this.props;

    return (
      ___EmotionJSX("div", { className: className, style: CONTAINER_STYLE },
      children));


  } // @ts-ignore
  __reactstandin__regenerateByEval(key, code) {// @ts-ignore
    this[key] = eval(code);}}TooltipFrame.propTypes = { className: _pt.string, children: _pt.node.isRequired };TooltipFrame.defaultProps = defaultProps;const _default =
TooltipFrame;export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(defaultProps, "defaultProps", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/chart-composition/tooltip/TooltipFrame.tsx");reactHotLoader.register(CONTAINER_STYLE, "CONTAINER_STYLE", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/chart-composition/tooltip/TooltipFrame.tsx");reactHotLoader.register(TooltipFrame, "TooltipFrame", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/chart-composition/tooltip/TooltipFrame.tsx");reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/chart-composition/tooltip/TooltipFrame.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();