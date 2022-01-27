(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /**
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
import { sections } from '@superset-ui/chart-controls';
import { t, validateNonEmpty } from '@superset-ui/core';
import {
filterNulls,
autozoom,
jsColumns,
jsDataMutator,
jsTooltip,
jsOnclickHref,
extruded,
gridSize,
viewport,
spatial,
mapboxStyle } from
'../../utilities/Shared_DeckGL';

const config = {
  controlPanelSections: [
  sections.legacyRegularTime,
  {
    label: t('Query'),
    expanded: true,
    controlSetRows: [
    [spatial],
    ['size'],
    ['row_limit'],
    [filterNulls],
    ['adhoc_filters']] },


  {
    label: t('Map'),
    controlSetRows: [
    [mapboxStyle, viewport],
    ['color_picker', autozoom],
    [gridSize, extruded]] },


  {
    label: t('Advanced'),
    controlSetRows: [
    [jsColumns],
    [jsDataMutator],
    [jsTooltip],
    [jsOnclickHref]] }],



  controlOverrides: {
    size: {
      label: t('Height'),
      description: t('Metric used to control height'),
      validators: [validateNonEmpty] } } };const _default =




config;export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(config, "config", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-deckgl/src/layers/Grid/controlPanel.ts");reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-deckgl/src/layers/Grid/controlPanel.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();