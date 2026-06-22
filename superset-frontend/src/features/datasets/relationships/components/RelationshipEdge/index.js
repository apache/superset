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
exports.RelationshipEdge = void 0;
var react_1 = require("react");
var react_2 = require("@xyflow/react");
var types_1 = require("../../types");
/**
 * Relationship type → human-readable label.
 */
var CARDINALITY_LABEL = {
    one_to_one: '1:1',
    one_to_many: '1:N',
    many_to_one: 'N:1',
    many_to_many: 'N:N',
};
/**
 * Custom React Flow edge representing a dataset relationship.
 * Displays cardinality, join type, and cross-DB indicator with
 * color-coded join types and compact labeling.
 */
function RelationshipEdgeComponent(_a) {
    var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    var id = _a.id, sourceX = _a.sourceX, sourceY = _a.sourceY, targetX = _a.targetX, targetY = _a.targetY, sourcePosition = _a.sourcePosition, targetPosition = _a.targetPosition, data = _a.data, selected = _a.selected;
    var rel = data === null || data === void 0 ? void 0 : data.relationship;
    var _m = (0, react_2.getSmoothStepPath)({
        sourceX: sourceX,
        sourceY: sourceY,
        targetX: targetX,
        targetY: targetY,
        sourcePosition: sourcePosition,
        targetPosition: targetPosition,
        borderRadius: 16,
    }), edgePath = _m[0], labelX = _m[1], labelY = _m[2];
    var isCrossDb = (_b = rel === null || rel === void 0 ? void 0 : rel.is_cross_database) !== null && _b !== void 0 ? _b : false;
    var joinType = (_c = rel === null || rel === void 0 ? void 0 : rel.join_type) !== null && _c !== void 0 ? _c : 'LEFT';
    var edgeColor = (_d = types_1.JOIN_TYPE_COLORS[joinType]) !== null && _d !== void 0 ? _d : '#bbb';
    var color = selected ? '#2893B3' : edgeColor;
    var cardinality = rel
        ? (_e = CARDINALITY_LABEL[rel.relationship_type]) !== null && _e !== void 0 ? _e : '?'
        : '';
    var joinLabel = joinType;
    // Build column pair tooltip
    var columnLabels = (_h = (_g = (_f = rel === null || rel === void 0 ? void 0 : rel.columns) === null || _f === void 0 ? void 0 : _f.map(function (c) { return "".concat(c.source_column_name, " ").concat(c.operator, " ").concat(c.target_column_name); })) === null || _g === void 0 ? void 0 : _g.join(', ')) !== null && _h !== void 0 ? _h : '';
    var compactColumns = (_l = (_k = (_j = rel === null || rel === void 0 ? void 0 : rel.columns) === null || _j === void 0 ? void 0 : _j.map(function (c) { return "".concat(c.source_column_name, " \u2192 ").concat(c.target_column_name); })) === null || _k === void 0 ? void 0 : _k.join(', ')) !== null && _l !== void 0 ? _l : '';
    return (<>
      <react_2.BaseEdge id={id} path={edgePath} style={{
            stroke: color,
            strokeWidth: selected ? 2.5 : 1.5,
            transition: 'stroke 0.2s ease',
        }} markerEnd={{
            type: react_2.MarkerType.ArrowClosed,
            color: color,
            width: selected ? 14 : 12,
            height: selected ? 14 : 12,
        }}/>
      <react_2.EdgeLabelRenderer>
        <div style={{
            position: 'absolute',
            transform: "translate(-50%, -50%) translate(".concat(labelX, "px,").concat(labelY, "px)"),
            pointerEvents: 'all',
            fontSize: '11px',
            fontFamily: 'inherit',
            background: selected ? '#fff' : '#fafafa',
            border: "1px solid ".concat(color),
            borderRadius: 5,
            padding: '3px 8px',
            color: '#333',
            whiteSpace: 'nowrap',
            boxShadow: selected
                ? '0 2px 8px rgba(0,0,0,0.1)'
                : '0 1px 4px rgba(0,0,0,0.05)',
            transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
        }} className="nodrag nopan" title={columnLabels || undefined}>
          <span style={{ fontWeight: 600 }}>
            {cardinality}
          </span>
          {joinLabel && (<span style={{
                marginLeft: 4,
                color: '#888',
                fontSize: '10px',
            }}>
              · {joinLabel}
            </span>)}
          {isCrossDb && (<span style={{
                marginLeft: 4,
                color: '#d4a017',
                fontSize: '11px',
            }} title="Cross-database relationship">
              ⚡
            </span>)}
          {!isCrossDb && compactColumns && (<div style={{
                fontSize: '9px',
                color: '#2893B3',
                marginTop: 1,
                maxWidth: 180,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
            }}>
              {compactColumns}
            </div>)}
        </div>
      </react_2.EdgeLabelRenderer>
    </>);
}
exports.RelationshipEdge = (0, react_1.memo)(RelationshipEdgeComponent);
