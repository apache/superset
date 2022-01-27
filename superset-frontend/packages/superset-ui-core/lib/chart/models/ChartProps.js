/*
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
/** Type checking is disabled for this file due to reselect only supporting
 * TS declarations for selectors with up to 12 arguments. */
// @ts-nocheck
import { createSelector } from 'reselect';
import { convertKeysToCamelCase, } from '../..';
const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;
export default class ChartProps {
    static createSelector;
    annotationData;
    datasource;
    rawDatasource;
    initialValues;
    formData;
    rawFormData;
    height;
    hooks;
    ownState;
    filterState;
    queriesData;
    width;
    behaviors;
    appSection;
    isRefreshing;
    constructor(config = {}) {
        const { annotationData = {}, datasource = {}, formData = {}, hooks = {}, ownState = {}, filterState = {}, initialValues = {}, queriesData = [], behaviors = [], width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT, appSection, isRefreshing, } = config;
        this.width = width;
        this.height = height;
        this.annotationData = annotationData;
        this.datasource = convertKeysToCamelCase(datasource);
        this.rawDatasource = datasource;
        this.formData = convertKeysToCamelCase(formData);
        this.rawFormData = formData;
        this.hooks = hooks;
        this.initialValues = initialValues;
        this.queriesData = queriesData;
        this.ownState = ownState;
        this.filterState = filterState;
        this.behaviors = behaviors;
        this.appSection = appSection;
        this.isRefreshing = isRefreshing;
    }
}
// eslint-disable-next-line func-name-matching
ChartProps.createSelector = function create() {
    return createSelector((input) => input.annotationData, input => input.datasource, input => input.formData, input => input.height, input => input.hooks, input => input.initialValues, input => input.queriesData, input => input.width, input => input.ownState, input => input.filterState, input => input.behaviors, input => input.appSection, input => input.isRefreshing, (annotationData, datasource, formData, height, hooks, initialValues, queriesData, width, ownState, filterState, behaviors, appSection, isRefreshing) => new ChartProps({
        annotationData,
        datasource,
        formData,
        height,
        hooks,
        initialValues,
        queriesData,
        ownState,
        filterState,
        width,
        behaviors,
        appSection,
        isRefreshing,
    }));
};
//# sourceMappingURL=ChartProps.js.map