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

import React, { useMemo } from 'react';
import { t } from '../../translation';import { jsx as ___EmotionJSX } from "@emotion/react";

const MESSAGE_STYLES = { maxWidth: 800 };
const TITLE_STYLES = {
  fontSize: 16,
  fontWeight: 'bold',
  paddingBottom: 8 };

const BODY_STYLES = { fontSize: 14 };
const MIN_WIDTH_FOR_BODY = 250;

const generateContainerStyles =


(height, width) => ({
  alignItems: 'center',
  display: 'flex',
  flexDirection: 'column',
  height,
  justifyContent: 'center',
  padding: 16,
  textAlign: 'center',
  width });









const NoResultsComponent = ({ className, height, id, width }) => {
  const containerStyles = useMemo(
  () => generateContainerStyles(height, width),
  [height, width]);


  // render the body if the width is auto/100% or greater than 250 pixels
  const shouldRenderBody =
  typeof width === 'string' || width > MIN_WIDTH_FOR_BODY;

  const BODY_STRING = t(
  'No results were returned for this query. If you expected results to be returned, ensure any filters are configured properly and the datasource contains data for the selected time range.');


  return (
    ___EmotionJSX("div", {
      className: className,
      id: id,
      style: containerStyles,
      title: shouldRenderBody ? undefined : BODY_STRING },

    ___EmotionJSX("div", { style: MESSAGE_STYLES },
    ___EmotionJSX("div", { style: TITLE_STYLES }, t('No Results')),
    shouldRenderBody && ___EmotionJSX("div", { style: BODY_STYLES }, BODY_STRING))));



};__signature__(NoResultsComponent, "useMemo{containerStyles}");NoResultsComponent.propTypes = { className: _pt.string, height: _pt.oneOfType([_pt.number, _pt.string]).isRequired, id: _pt.string, width: _pt.oneOfType([_pt.number, _pt.string]).isRequired };const _default =

NoResultsComponent;export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(MESSAGE_STYLES, "MESSAGE_STYLES", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/chart/components/NoResultsComponent.tsx");reactHotLoader.register(TITLE_STYLES, "TITLE_STYLES", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/chart/components/NoResultsComponent.tsx");reactHotLoader.register(BODY_STYLES, "BODY_STYLES", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/chart/components/NoResultsComponent.tsx");reactHotLoader.register(MIN_WIDTH_FOR_BODY, "MIN_WIDTH_FOR_BODY", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/chart/components/NoResultsComponent.tsx");reactHotLoader.register(generateContainerStyles, "generateContainerStyles", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/chart/components/NoResultsComponent.tsx");reactHotLoader.register(NoResultsComponent, "NoResultsComponent", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/chart/components/NoResultsComponent.tsx");reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/chart/components/NoResultsComponent.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();