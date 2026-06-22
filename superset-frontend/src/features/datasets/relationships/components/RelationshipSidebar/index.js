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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
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
var react_1 = require("react");
var components_1 = require("@superset-ui/core/components");
var types_1 = require("../../types");
var ColumnPickerModal_1 = require("../ColumnPickerModal");
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
var RELATIONSHIP_TYPE_OPTIONS = [
    { value: 'one_to_one', label: '1:1' },
    { value: 'one_to_many', label: '1:N' },
    { value: 'many_to_one', label: 'N:1' },
    { value: 'many_to_many', label: 'N:N' },
];
var JOIN_TYPE_OPTIONS = [
    { value: 'LEFT', label: 'LEFT' },
    { value: 'INNER', label: 'INNER' },
    { value: 'RIGHT', label: 'RIGHT' },
    { value: 'FULL', label: 'FULL' },
];
var CARDINALITY_LABEL = {
    one_to_one: '1:1',
    one_to_many: '1:N',
    many_to_one: 'N:1',
    many_to_many: 'N:N',
};
function TabBar(_a) {
    var activeTab = _a.activeTab, onChange = _a.onChange, relationshipCount = _a.relationshipCount;
    var tabs = [
        { key: 'grid', label: "Grid (".concat(relationshipCount, ")") },
        { key: 'detail', label: 'Detail' },
        { key: 'new', label: '+' },
    ];
    return (<div style={{
            display: 'flex',
            borderBottom: '1px solid #e8e8e8',
            background: '#fafafa',
        }}>
      {tabs.map(function (tab) {
            var isActive = activeTab === tab.key;
            return (<button key={tab.key} type="button" onClick={function () { return onChange(tab.key); }} style={{
                    flex: tab.key === 'new' ? 0 : 1,
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? '#2893B3' : '#666',
                    background: isActive ? '#fff' : 'transparent',
                    border: 'none',
                    borderBottom: isActive ? '2px solid #2893B3' : '2px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    outline: 'none',
                    whiteSpace: 'nowrap',
                }}>
            {tab.label}
          </button>);
        })}
    </div>);
}
function GridTab(_a) {
    var _this = this;
    var relationships = _a.relationships, allDatasets = _a.allDatasets, onSelect = _a.onSelect, onToggleActive = _a.onToggleActive, onDelete = _a.onDelete;
    var _b = (0, react_1.useState)(''), search = _b[0], setSearch = _b[1];
    var _c = (0, react_1.useState)('name'), sortBy = _c[0], setSortBy = _c[1];
    var _d = (0, react_1.useState)(null), confirmDeleteId = _d[0], setConfirmDeleteId = _d[1];
    var filtered = (0, react_1.useMemo)(function () {
        var list = __spreadArray([], relationships, true);
        if (search.trim()) {
            var s_1 = search.toLowerCase();
            list = list.filter(function (rel) {
                var _a;
                return ((_a = rel.name) !== null && _a !== void 0 ? _a : '').toLowerCase().includes(s_1) ||
                    "rel #".concat(rel.id).includes(s_1);
            });
        }
        list.sort(function (a, b) {
            var _a, _b, _c, _d;
            if (sortBy === 'name') {
                var na = (_a = a.name) !== null && _a !== void 0 ? _a : "rel-".concat(a.id);
                var nb = (_b = b.name) !== null && _b !== void 0 ? _b : "rel-".concat(b.id);
                return na.localeCompare(nb);
            }
            var da = (_c = a.created_on) !== null && _c !== void 0 ? _c : '';
            var db = (_d = b.created_on) !== null && _d !== void 0 ? _d : '';
            return da.localeCompare(db);
        });
        return list;
    }, [relationships, search, sortBy]);
    var datasetName = (0, react_1.useCallback)(function (id) {
        var _a;
        var ds = allDatasets.find(function (d) { return d.id === id; });
        return (_a = ds === null || ds === void 0 ? void 0 : ds.table_name) !== null && _a !== void 0 ? _a : "Dataset #".concat(id);
    }, [allDatasets]);
    var handleDelete = (0, react_1.useCallback)(function (id) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setConfirmDeleteId(null);
                    return [4 /*yield*/, onDelete(id)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); }, [onDelete]);
    if (relationships.length === 0) {
        return (<div style={{ padding: 16, color: '#666', fontSize: '13px' }}>
        <p style={{ margin: '0 0 8px 0' }}>
          <strong>No relationships yet.</strong>
        </p>
        <p style={{ margin: 0, color: '#999' }}>
          Drag a connection between two dataset columns on the canvas, or use the{' '}
          <strong>+ tab</strong> to create one.
        </p>
      </div>);
    }
    return (<div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
        }}>
      {/* Search + sort */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>
        <components_1.Input value={search} onChange={function (e) {
            return setSearch(e.target.value);
        }} placeholder="Search relationships…" style={{ fontSize: '12px', marginBottom: 6 }}/>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: '#999' }}>Sort:</span>
          <button type="button" onClick={function () { return setSortBy('name'); }} style={{
            fontSize: '11px',
            padding: '2px 6px',
            background: sortBy === 'name' ? '#2893B3' : '#e8e8e8',
            color: sortBy === 'name' ? '#fff' : '#666',
            border: 'none',
            borderRadius: 3,
            cursor: 'pointer',
        }}>
            Name
          </button>
          <button type="button" onClick={function () { return setSortBy('created'); }} style={{
            fontSize: '11px',
            padding: '2px 6px',
            background: sortBy === 'created' ? '#2893B3' : '#e8e8e8',
            color: sortBy === 'created' ? '#fff' : '#666',
            border: 'none',
            borderRadius: 3,
            cursor: 'pointer',
        }}>
            Created
          </button>
        </div>
      </div>

      {/* Relationship list */}
      <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '4px 0',
        }}>
        {filtered.map(function (rel) {
            var _a, _b, _c, _d;
            var relName = (_a = rel.name) !== null && _a !== void 0 ? _a : "Rel #".concat(rel.id);
            return (<div key={rel.id} onClick={function () { return onSelect(rel); }} style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid #f0f0f0',
                    cursor: 'pointer',
                    transition: 'background 0.1s ease',
                    fontSize: '12px',
                }} onMouseEnter={function (e) {
                    e.currentTarget.style.background = '#f5f9fc';
                }} onMouseLeave={function (e) {
                    e.currentTarget.style.background = '#fff';
                }}>
              <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 4,
                }}>
                {/* Active/inactive badge */}
                <span style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: rel.is_active ? '#52c41a' : '#ccc',
                    display: 'inline-block',
                    flexShrink: 0,
                }} title={rel.is_active ? 'Active' : 'Inactive'}/>
                <span style={{
                    fontWeight: 600,
                    color: '#333',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                }}>
                  {relName}
                </span>
              </div>

              <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    color: '#666',
                    fontSize: '11px',
                }}>
                <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {datasetName(rel.source_dataset_id)}
                </span>
                <span style={{ color: '#ccc' }}>→</span>
                <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {datasetName(rel.target_dataset_id)}
                </span>

                <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
                  {/* Cardinality tag */}
                  <span style={{
                    fontSize: '10px',
                    background: '#f0f0f0',
                    color: '#666',
                    padding: '1px 4px',
                    borderRadius: 3,
                    fontWeight: 600,
                }}>
                    {(_b = CARDINALITY_LABEL[rel.relationship_type]) !== null && _b !== void 0 ? _b : '?'}
                  </span>

                  {/* Join type tag */}
                  <span style={{
                    fontSize: '9px',
                    background: "".concat((_c = types_1.JOIN_TYPE_COLORS[rel.join_type]) !== null && _c !== void 0 ? _c : '#999', "20"),
                    color: (_d = types_1.JOIN_TYPE_COLORS[rel.join_type]) !== null && _d !== void 0 ? _d : '#999',
                    padding: '1px 4px',
                    borderRadius: 3,
                }}>
                    {rel.join_type}
                  </span>

                  {/* Active toggle */}
                  <button type="button" onClick={function (e) {
                    e.stopPropagation();
                    onToggleActive(rel.id, !rel.is_active);
                }} style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 2,
                    fontSize: '13px',
                    color: rel.is_active ? '#52c41a' : '#ccc',
                    lineHeight: 1,
                }} title={rel.is_active ? 'Deactivate' : 'Activate'}>
                    {rel.is_active ? '👁' : '👁‍🗨'}
                  </button>

                  {/* Delete button */}
                  {confirmDeleteId === rel.id ? (<span style={{ fontSize: '10px', display: 'flex', gap: 4 }}>
                      <button type="button" onClick={function (e) {
                        e.stopPropagation();
                        handleDelete(rel.id);
                    }} style={{
                        background: '#ff4d4f',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 3,
                        padding: '1px 4px',
                        fontSize: '10px',
                        cursor: 'pointer',
                    }}>
                        Confirm
                      </button>
                      <button type="button" onClick={function (e) {
                        e.stopPropagation();
                        setConfirmDeleteId(null);
                    }} style={{
                        background: '#e8e8e8',
                        border: 'none',
                        borderRadius: 3,
                        padding: '1px 4px',
                        fontSize: '10px',
                        cursor: 'pointer',
                    }}>
                        ✕
                      </button>
                    </span>) : (<button type="button" onClick={function (e) {
                        e.stopPropagation();
                        setConfirmDeleteId(rel.id);
                    }} style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 2,
                        fontSize: '12px',
                        color: '#ccc',
                        lineHeight: 1,
                    }} title="Delete">
                      🗑
                    </button>)}
                </div>
              </div>
            </div>);
        })}
      </div>
    </div>);
}
function DetailTab(_a) {
    var _this = this;
    var _b, _c, _d, _e, _f, _g, _h, _j, _k;
    var relationship = _a.relationship, sourceDataset = _a.sourceDataset, targetDataset = _a.targetDataset, onUpdate = _a.onUpdate, onDelete = _a.onDelete, onBack = _a.onBack;
    var _l = (0, react_1.useState)(false), saving = _l[0], setSaving = _l[1];
    var _m = (0, react_1.useState)(false), showColumnPicker = _m[0], setShowColumnPicker = _m[1];
    var _o = (0, react_1.useState)((_b = relationship === null || relationship === void 0 ? void 0 : relationship.relationship_type) !== null && _b !== void 0 ? _b : 'many_to_one'), relType = _o[0], setRelType = _o[1];
    var _p = (0, react_1.useState)((_c = relationship === null || relationship === void 0 ? void 0 : relationship.join_type) !== null && _c !== void 0 ? _c : 'LEFT'), joinType = _p[0], setJoinType = _p[1];
    var _q = (0, react_1.useState)((_d = relationship === null || relationship === void 0 ? void 0 : relationship.name) !== null && _d !== void 0 ? _d : ''), name = _q[0], setName = _q[1];
    var _r = (0, react_1.useState)((_e = relationship === null || relationship === void 0 ? void 0 : relationship.description) !== null && _e !== void 0 ? _e : ''), description = _r[0], setDescription = _r[1];
    var _s = (0, react_1.useState)((_f = relationship === null || relationship === void 0 ? void 0 : relationship.is_active) !== null && _f !== void 0 ? _f : true), isActive = _s[0], setIsActive = _s[1];
    var _t = (0, react_1.useState)((_g = relationship === null || relationship === void 0 ? void 0 : relationship.columns) !== null && _g !== void 0 ? _g : []), columns = _t[0], setColumns = _t[1];
    var handleSave = (0, react_1.useCallback)(function () { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!relationship)
                        return [2 /*return*/];
                    setSaving(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, , 3, 4]);
                    return [4 /*yield*/, onUpdate(relationship.id, {
                            relationship_type: relType,
                            join_type: joinType,
                            name: name || null,
                            description: description || null,
                            is_active: isActive,
                            columns: columns.map(function (col, i) { return ({
                                source_column_name: col.source_column_name,
                                target_column_name: col.target_column_name,
                                operator: col.operator,
                                ordinal: i,
                            }); }),
                        })];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    setSaving(false);
                    return [7 /*endfinally*/];
                case 4: return [2 /*return*/];
            }
        });
    }); }, [relationship, relType, joinType, name, description, isActive, columns, onUpdate]);
    var handleDelete = (0, react_1.useCallback)(function () { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!relationship)
                        return [2 /*return*/];
                    if (!window.confirm('Delete this relationship permanently?')) return [3 /*break*/, 2];
                    return [4 /*yield*/, onDelete(relationship.id)];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2: return [2 /*return*/];
            }
        });
    }); }, [relationship, onDelete]);
    return (<div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: 12,
            height: '100%',
            overflowY: 'auto',
            fontSize: '13px',
        }}>
      {/* Back button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" onClick={onBack} style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '13px',
            color: '#2893B3',
            padding: 0,
        }}>
          ← Back to Grid
        </button>
      </div>

      {/* Info card */}
      <div style={{
            background: '#fafafa',
            borderRadius: 6,
            padding: 12,
            border: '1px solid #e8e8e8',
        }}>
        <h4 style={{
            margin: '0 0 8px 0',
            fontSize: '14px',
            color: '#333',
            fontWeight: 600,
        }}>
          {(_h = relationship.name) !== null && _h !== void 0 ? _h : "Relationship #".concat(relationship.id)}
        </h4>

        <div style={{ fontSize: '12px', color: '#666', marginBottom: 4 }}>
          <strong>Source:</strong>{' '}
          {(_j = sourceDataset === null || sourceDataset === void 0 ? void 0 : sourceDataset.table_name) !== null && _j !== void 0 ? _j : "Dataset #".concat(relationship.source_dataset_id)}
          {relationship.is_cross_database && (<span style={{ color: '#d4a017', marginLeft: 6 }}>⚡ Cross-DB</span>)}
        </div>
        <div style={{ fontSize: '12px', color: '#666' }}>
          <strong>Target:</strong>{' '}
          {(_k = targetDataset === null || targetDataset === void 0 ? void 0 : targetDataset.table_name) !== null && _k !== void 0 ? _k : "Dataset #".concat(relationship.target_dataset_id)}
        </div>
      </div>

      {/* Fields card */}
      <div style={{
            background: '#fff',
            borderRadius: 6,
            padding: 12,
            border: '1px solid #e8e8e8',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
        }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#555' }}>
          Information
        </div>

        <div>
          <label style={{
            display: 'block',
            marginBottom: 3,
            fontSize: '11px',
            color: '#666',
            fontWeight: 600,
        }}>
            Name
          </label>
          <components_1.Input value={name} onChange={function (e) {
            return setName(e.target.value);
        }} placeholder="Optional name…" style={{ fontSize: '12px' }}/>
        </div>

        <div>
          <label style={{
            display: 'block',
            marginBottom: 3,
            fontSize: '11px',
            color: '#666',
            fontWeight: 600,
        }}>
            Description
          </label>
          <components_1.Input value={description} onChange={function (e) {
            return setDescription(e.target.value);
        }} placeholder="Optional description…" style={{ fontSize: '12px' }}/>
        </div>

        <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
        }}>
          <div>
            <label style={{
            display: 'block',
            marginBottom: 3,
            fontSize: '11px',
            color: '#666',
            fontWeight: 600,
        }}>
              Cardinality
            </label>
            <components_1.Select value={relType} options={RELATIONSHIP_TYPE_OPTIONS} onChange={function (v) { return setRelType(v); }}/>
          </div>
          <div>
            <label style={{
            display: 'block',
            marginBottom: 3,
            fontSize: '11px',
            color: '#666',
            fontWeight: 600,
        }}>
              Join Type
            </label>
            <components_1.Select value={joinType} options={JOIN_TYPE_OPTIONS} onChange={function (v) { return setJoinType(v); }}/>
          </div>
        </div>

        <div>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '12px',
            cursor: 'pointer',
        }}>
            <input type="checkbox" checked={isActive} onChange={function (e) { return setIsActive(e.target.checked); }} style={{ cursor: 'pointer' }}/>
            <span style={{ fontWeight: 600, color: '#555' }}>Active</span>
          </label>
        </div>
      </div>

      {/* Column mappings card */}
      <div style={{
            background: '#fff',
            borderRadius: 6,
            padding: 12,
            border: '1px solid #e8e8e8',
        }}>
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
        }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#555' }}>
            Column Mappings ({columns.length})
          </span>
          <components_1.Button buttonSize="xsmall" buttonStyle="primary" onClick={function () { return setShowColumnPicker(true); }}>
            Edit
          </components_1.Button>
        </div>
        {columns.length > 0 ? (<div style={{
                background: '#fafafa',
                borderRadius: 4,
                padding: 8,
            }}>
            {columns.map(function (col, i) { return (<div key={col.source_column_name + col.target_column_name + i} style={{ fontSize: '11px', marginBottom: 3 }}>
                <span style={{ fontWeight: 600, color: '#333' }}>
                  {col.source_column_name}
                </span>{' '}
                <span style={{ color: '#2893B3' }}>{col.operator}</span>{' '}
                <span style={{ fontWeight: 600, color: '#333' }}>
                  {col.target_column_name}
                </span>
              </div>); })}
          </div>) : (<div style={{ color: '#999', fontSize: '12px' }}>
            No column mappings configured.
          </div>)}
      </div>

      {/* Actions card */}
      <div style={{
            background: '#fff',
            borderRadius: 6,
            padding: 12,
            border: '1px solid #e8e8e8',
            display: 'flex',
            gap: 8,
            marginTop: 'auto',
        }}>
        <components_1.Button buttonSize="small" buttonStyle="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </components_1.Button>
        <components_1.Button buttonSize="small" buttonStyle="danger" onClick={handleDelete} disabled={saving}>
          Delete
        </components_1.Button>
      </div>

      {/* Column Picker Modal */}
      <ColumnPickerModal_1.default show={showColumnPicker} sourceDataset={sourceDataset} targetDataset={targetDataset} initialColumns={columns} onSave={setColumns} onHide={function () { return setShowColumnPicker(false); }}/>
    </div>);
}
function NewTab(_a) {
    var _b, _c;
    var allDatasets = _a.allDatasets, pendingNewRel = _a.pendingNewRel, onCreate = _a.onCreate, onCancel = _a.onCancel;
    var _d = (0, react_1.useState)(pendingNewRel === null || pendingNewRel === void 0 ? void 0 : pendingNewRel.sourceId), sourceId = _d[0], setSourceId = _d[1];
    var _e = (0, react_1.useState)(pendingNewRel === null || pendingNewRel === void 0 ? void 0 : pendingNewRel.targetId), targetId = _e[0], setTargetId = _e[1];
    var _f = (0, react_1.useState)(false), showColumnPicker = _f[0], setShowColumnPicker = _f[1];
    var _g = (0, react_1.useState)([]), columns = _g[0], setColumns = _g[1];
    var datasetOptions = (0, react_1.useMemo)(function () {
        return allDatasets.map(function (ds) {
            var _a, _b;
            return ({
                value: ds.id,
                label: "".concat(ds.table_name, " (").concat((_b = (_a = ds.database) === null || _a === void 0 ? void 0 : _a.database_name) !== null && _b !== void 0 ? _b : '?', ")"),
            });
        });
    }, [allDatasets]);
    var handleCreate = (0, react_1.useCallback)(function () {
        if (!sourceId || !targetId || columns.length === 0)
            return;
        onCreate(columns);
    }, [sourceId, targetId, columns, onCreate]);
    var canCreate = sourceId && targetId && columns.length > 0;
    return (<div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            padding: 12,
            fontSize: '13px',
        }}>
      {pendingNewRel && (<div style={{
                background: '#e6f7ff',
                border: '1px solid #91d5ff',
                borderRadius: 6,
                padding: '8px 12px',
                fontSize: '12px',
                color: '#0050b3',
            }}>
          Creating relationship from column connection
        </div>)}

      <div>
        <label style={{
            display: 'block',
            marginBottom: 3,
            fontSize: '11px',
            color: '#666',
            fontWeight: 600,
        }}>
          Source Dataset
        </label>
        <components_1.Select value={sourceId} options={datasetOptions} onChange={function (v) { return setSourceId(v); }} placeholder="Select source dataset…"/>
      </div>

      <div>
        <label style={{
            display: 'block',
            marginBottom: 3,
            fontSize: '11px',
            color: '#666',
            fontWeight: 600,
        }}>
          Target Dataset
        </label>
        <components_1.Select value={targetId} options={datasetOptions} onChange={function (v) { return setTargetId(v); }} placeholder="Select target dataset…"/>
      </div>

      <div>
        <label style={{
            display: 'block',
            marginBottom: 3,
            fontSize: '11px',
            color: '#666',
            fontWeight: 600,
        }}>
          Column Mappings ({columns.length})
        </label>
        <components_1.Button buttonSize="small" buttonStyle="tertiary" onClick={function () { return setShowColumnPicker(true); }}>
          Configure Columns
        </components_1.Button>
        {columns.length > 0 && (<div style={{
                marginTop: 8,
                background: '#fafafa',
                borderRadius: 4,
                padding: 8,
            }}>
            {columns.map(function (col, i) { return (<div key={col.source_column_name + col.target_column_name + i} style={{ fontSize: '11px', marginBottom: 3 }}>
                <span style={{ fontWeight: 600 }}>{col.source_column_name}</span>{' '}
                {col.operator}{' '}
                <span style={{ fontWeight: 600 }}>{col.target_column_name}</span>
              </div>); })}
          </div>)}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <components_1.Button buttonSize="small" buttonStyle="primary" onClick={handleCreate} disabled={!canCreate}>
          Create Relationship
        </components_1.Button>
        <components_1.Button buttonSize="small" buttonStyle="secondary" onClick={onCancel}>
          Cancel
        </components_1.Button>
      </div>

      <ColumnPickerModal_1.default show={showColumnPicker} sourceDataset={sourceId ? (_b = allDatasets.find(function (d) { return d.id === sourceId; })) !== null && _b !== void 0 ? _b : null : null} targetDataset={targetId ? (_c = allDatasets.find(function (d) { return d.id === targetId; })) !== null && _c !== void 0 ? _c : null : null} initialColumns={columns} onSave={function (cols) {
            setColumns(cols);
            setShowColumnPicker(false);
        }} onHide={function () { return setShowColumnPicker(false); }}/>
    </div>);
}
// ---------------------------------------------------------------------------
// Main Sidebar
// ---------------------------------------------------------------------------
function RelationshipSidebar(_a) {
    var _this = this;
    var relationship = _a.relationship, sourceDataset = _a.sourceDataset, targetDataset = _a.targetDataset, allRelationships = _a.allRelationships, allDatasets = _a.allDatasets, onUpdate = _a.onUpdate, onDelete = _a.onDelete, onClose = _a.onClose, onSelectRelationship = _a.onSelectRelationship, pendingConnection = _a.pendingConnection, onCreateFromPending = _a.onCreateFromPending, onCancelPending = _a.onCancelPending;
    var _b = (0, react_1.useState)(relationship ? 'detail' : 'grid'), activeTab = _b[0], setActiveTab = _b[1];
    var handleToggleActive = (0, react_1.useCallback)(function (id, newActive) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, onUpdate(id, { is_active: newActive })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); }, [onUpdate]);
    var handleSelectRelationship = (0, react_1.useCallback)(function (rel) {
        onSelectRelationship(rel);
        setActiveTab('detail');
    }, [onSelectRelationship]);
    var handleNewFromPending = (0, react_1.useCallback)(function (columns) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, onCreateFromPending(columns)];
                case 1:
                    _a.sent();
                    setActiveTab('grid');
                    return [2 /*return*/];
            }
        });
    }); }, [onCreateFromPending]);
    // If a pending connection exists, switch to the new tab
    if (pendingConnection && activeTab !== 'new') {
        setActiveTab('new');
    }
    return (<div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
            fontFamily: 'inherit',
            fontSize: '13px',
            background: '#fff',
        }}>
      <TabBar activeTab={activeTab} onChange={setActiveTab} relationshipCount={allRelationships.length}/>

      <div style={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
        }}>
        {activeTab === 'grid' && (<GridTab relationships={allRelationships} allDatasets={allDatasets} onSelect={handleSelectRelationship} onToggleActive={handleToggleActive} onDelete={onDelete}/>)}

        {activeTab === 'detail' && relationship ? (<DetailTab relationship={relationship} sourceDataset={sourceDataset} targetDataset={targetDataset} onUpdate={onUpdate} onDelete={onDelete} onBack={function () {
                onClose();
                setActiveTab('grid');
            }}/>) : activeTab === 'detail' && !relationship ? (<div style={{ padding: 16, color: '#999', fontSize: '13px' }}>
            Select a relationship from the grid to view details.
          </div>) : null}

        {activeTab === 'new' && (<NewTab allDatasets={allDatasets} pendingNewRel={pendingConnection} onCreate={pendingConnection ? handleNewFromPending : function (columns) { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: 
                        // Regular create handled by canvas
                        return [4 /*yield*/, onCreateFromPending(columns)];
                        case 1:
                            // Regular create handled by canvas
                            _a.sent();
                            setActiveTab('grid');
                            return [2 /*return*/];
                    }
                });
            }); }} onCancel={function () {
                onCancelPending();
                setActiveTab('grid');
            }}/>)}
      </div>
    </div>);
}
exports.default = RelationshipSidebar;
