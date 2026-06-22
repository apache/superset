"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RelationshipPanel = void 0;
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
var react_1 = require("react");
/**
 * Panel section in the Explore datasource sidebar showing
 * available relationships and their JOIN status.
 *
 * Users can:
 * - Toggle JOIN on/off
 * - See which columns map to which target
 * - Select which target columns to include
 */
function RelationshipPanel(_a) {
    var relationships = _a.relationships, activeJoins = _a.activeJoins, availableTargetColumns = _a.availableTargetColumns, onToggleJoin = _a.onToggleJoin, onUpdateSelectedColumns = _a.onUpdateSelectedColumns;
    var _b = (0, react_1.useState)(false), expanded = _b[0], setExpanded = _b[1];
    if (relationships.length === 0)
        return null;
    return (<div style={{
            padding: '16px',
            borderBottom: '1px solid #e8e8e8',
        }}>
      <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
        }}>
        <h4 style={{
            margin: 0,
            fontSize: '13px',
            fontWeight: 600,
        }}>
          Relationships
        </h4>
        {relationships.length > 1 && (<button type="button" onClick={function () { return setExpanded(!expanded); }} style={{
                border: 'none',
                background: 'none',
                fontSize: '12px',
                color: '#2893B3',
                cursor: 'pointer',
                padding: 0,
            }}>
            {expanded ? 'Collapse' : 'Show all'}
          </button>)}
      </div>

      {(expanded ? relationships : relationships.slice(0, 1)).map(function (rel) {
            var _a, _b, _c, _d, _e, _f;
            var join = activeJoins.get(rel.id);
            var enabled = (_a = join === null || join === void 0 ? void 0 : join.enabled) !== null && _a !== void 0 ? _a : false;
            var selectedCols = (_b = join === null || join === void 0 ? void 0 : join.selectedColumns) !== null && _b !== void 0 ? _b : [];
            var targetCols = (_c = availableTargetColumns.get(rel.id)) !== null && _c !== void 0 ? _c : [];
            return (<div key={rel.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    marginBottom: '4px',
                    borderRadius: '6px',
                    background: enabled
                        ? 'rgba(5, 150, 105, 0.06)'
                        : '#fafafa',
                    border: '1px solid',
                    borderColor: enabled ? 'rgba(5, 150, 105, 0.2)' : '#e8e8e8',
                    transition: 'all 0.15s ease',
                }} onMouseEnter={function (e) {
                    e.currentTarget.style.background = enabled
                        ? 'rgba(5, 150, 105, 0.1)'
                        : '#f0f0f0';
                }} onMouseLeave={function (e) {
                    e.currentTarget.style.background = enabled
                        ? 'rgba(5, 150, 105, 0.06)'
                        : '#fafafa';
                }}>
            <button type="button" onClick={function () { return onToggleJoin(rel.id); }} style={{
                    width: 28,
                    height: 16,
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    padding: 2,
                    transition: 'all 0.15s ease',
                    flexShrink: 0,
                    backgroundColor: enabled ? '#059669' : '#e0e0e0',
                    position: 'relative',
                }}>
              <span style={{
                    display: 'block',
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: 'white',
                    transition: 'transform 0.15s ease',
                    transform: enabled ? 'translateX(12px)' : 'translateX(0)',
                }}/>
            </button>

            <div style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: '12px',
                }}>
              <div style={{
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                }}>
                {(_d = rel.name) !== null && _d !== void 0 ? _d : "Relationship #".concat(rel.id)}
              </div>
              <div style={{
                    color: '#666',
                    fontSize: '11px',
                    marginTop: 1,
                }}>
                {rel.relationship_type.replace(/_/g, ' \u2192 ')} &middot;{' '}
                {rel.join_type} JOIN &middot;{' '}
                {(_f = (_e = rel.columns) === null || _e === void 0 ? void 0 : _e.map(function (col) {
                    return "".concat(col.source_column_name, " \u2192 ").concat(col.target_column_name);
                }).join(', ')) !== null && _f !== void 0 ? _f : ''}
              </div>
              {enabled && targetCols.length > 0 && (<div style={{
                        marginTop: '4px',
                    }}>
                  {targetCols.map(function (colName) { return (<label key={colName} style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            padding: '1px 4px',
                            margin: '1px 4px 1px 0',
                            borderRadius: 2,
                            background: '#f0f0f0',
                            cursor: 'pointer',
                        }}>
                      <input type="checkbox" checked={selectedCols.includes(colName)} onChange={function (e) {
                            if (e.target.checked) {
                                onUpdateSelectedColumns(rel.id, __spreadArray(__spreadArray([], selectedCols, true), [
                                    colName,
                                ], false));
                            }
                            else {
                                onUpdateSelectedColumns(rel.id, selectedCols.filter(function (c) { return c !== colName; }));
                            }
                        }} style={{ margin: 0, cursor: 'pointer' }}/>
                      {colName}
                    </label>); })}
                </div>)}
            </div>
          </div>);
        })}
    </div>);
}
exports.RelationshipPanel = RelationshipPanel;
