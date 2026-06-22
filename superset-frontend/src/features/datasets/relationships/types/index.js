"use strict";
/* eslint-disable camelcase */
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain the copy of the License at
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
exports.JOIN_TYPE_COLORS = exports.hashStringToBg = exports.hashStringToColor = exports.COLUMN_OPERATORS = exports.JOIN_TYPES = exports.RELATIONSHIP_TYPES = void 0;
// ---------------------------------------------------------------------------
// Enums & constants
// ---------------------------------------------------------------------------
exports.RELATIONSHIP_TYPES = [
    'one_to_one',
    'one_to_many',
    'many_to_one',
    'many_to_many',
];
exports.JOIN_TYPES = ['INNER', 'LEFT', 'RIGHT', 'FULL'];
exports.COLUMN_OPERATORS = [
    '=',
    '!=',
    '>',
    '<',
    '>=',
    '<=',
];
// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------
/**
 * Deterministic color from a string (e.g., database name).
 * Returns a pastel-ish hue for the badge.
 */
function hashStringToColor(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    var hue = Math.abs(hash) % 360;
    return "hsl(".concat(hue, ", 55%, 45%)");
}
exports.hashStringToColor = hashStringToColor;
function hashStringToBg(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    var hue = Math.abs(hash) % 360;
    return "hsl(".concat(hue, ", 40%, 92%)");
}
exports.hashStringToBg = hashStringToBg;
// ---------------------------------------------------------------------------
// Join type colors for edges
// ---------------------------------------------------------------------------
exports.JOIN_TYPE_COLORS = {
    LEFT: '#2893B3',
    INNER: '#52c41a',
    RIGHT: '#fa8c16',
    FULL: '#722ed1',
};
