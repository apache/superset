"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DndItemType = void 0;
/**
 * All possible draggable items for the chart controls.
 */
var DndItemType;
(function (DndItemType) {
    // an existing column in table
    DndItemType["Column"] = "column";
    // a selected column option in ColumnSelectControl
    DndItemType["ColumnOption"] = "columnOption";
    // an adhoc column option in ColumnSelectControl
    DndItemType["AdhocColumnOption"] = "adhocColumn";
    // a saved metric
    DndItemType["Metric"] = "metric";
    // a selected saved metric in MetricsControl
    DndItemType["MetricOption"] = "metricOption";
    // an adhoc metric option in MetricsControl
    DndItemType["AdhocMetricOption"] = "adhocMetric";
    // an adhoc filter option
    DndItemType["FilterOption"] = "filterOption";
})(DndItemType || (exports.DndItemType = DndItemType = {}));
