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
export var AnnotationType;
(function (AnnotationType) {
    AnnotationType["Event"] = "EVENT";
    AnnotationType["Formula"] = "FORMULA";
    AnnotationType["Interval"] = "INTERVAL";
    AnnotationType["Timeseries"] = "TIME_SERIES";
})(AnnotationType || (AnnotationType = {}));
export var AnnotationSourceType;
(function (AnnotationSourceType) {
    AnnotationSourceType["Line"] = "line";
    AnnotationSourceType["Native"] = "NATIVE";
    AnnotationSourceType["Table"] = "table";
    AnnotationSourceType["Undefined"] = "";
})(AnnotationSourceType || (AnnotationSourceType = {}));
export var AnnotationOpacity;
(function (AnnotationOpacity) {
    AnnotationOpacity["High"] = "opacityHigh";
    AnnotationOpacity["Low"] = "opacityLow";
    AnnotationOpacity["Medium"] = "opacityMedium";
    AnnotationOpacity["Undefined"] = "";
})(AnnotationOpacity || (AnnotationOpacity = {}));
export var AnnotationStyle;
(function (AnnotationStyle) {
    AnnotationStyle["Dashed"] = "dashed";
    AnnotationStyle["Dotted"] = "dotted";
    AnnotationStyle["Solid"] = "solid";
    AnnotationStyle["LongDashed"] = "longDashed";
})(AnnotationStyle || (AnnotationStyle = {}));
export function isFormulaAnnotationLayer(layer) {
    return layer.annotationType === AnnotationType.Formula;
}
export function isEventAnnotationLayer(layer) {
    return layer.annotationType === AnnotationType.Event;
}
export function isIntervalAnnotationLayer(layer) {
    return layer.annotationType === AnnotationType.Interval;
}
export function isTimeseriesAnnotationLayer(layer) {
    return layer.annotationType === AnnotationType.Timeseries;
}
export function isTableAnnotationLayer(layer) {
    return layer.sourceType === AnnotationSourceType.Table;
}
export function isTimeseriesAnnotationResult(result) {
    return Array.isArray(result);
}
export function isRecordAnnotationResult(result) {
    return 'columns' in result && 'records' in result;
}
//# sourceMappingURL=AnnotationLayer.js.map