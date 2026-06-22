"use strict";
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  this file that was agreed to
 * by you in writing, software distributed under the License
 * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
 * CONDITIONS OF ANY KIND, either express or implied.  See
 * the License for the specific language governing permissions
 * and limitations under the License.
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
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
var hooks_1 = require("../../hooks");
function DrillDownConfigModal(_a) {
    var show = _a.show, initialHierarchies = _a.hierarchies, onSave = _a.onSave, onHide = _a.onHide;
    var datasets = (0, hooks_1.useDatasetList)().datasets;
    var _b = (0, react_1.useState)(initialHierarchies), hierarchies = _b[0], setHierarchies = _b[1];
    var addHierarchy = (0, react_1.useCallback)(function () {
        setHierarchies(function (prev) { return __spreadArray(__spreadArray([], prev, true), [
            {
                id: "hierarchy-".concat(Date.now()),
                name: '',
                levels: [],
            },
        ], false); });
    }, []);
    var removeHierarchy = (0, react_1.useCallback)(function (hId) {
        setHierarchies(function (prev) { return prev.filter(function (h) { return h.id !== hId; }); });
    }, []);
    var updateHierarchyName = (0, react_1.useCallback)(function (hId, name) {
        setHierarchies(function (prev) {
            return prev.map(function (h) { return (h.id === hId ? __assign(__assign({}, h), { name: name }) : h); });
        });
    }, []);
    var addLevel = (0, react_1.useCallback)(function (hId) {
        setHierarchies(function (prev) {
            return prev.map(function (h) {
                return h.id === hId
                    ? __assign(__assign({}, h), { levels: __spreadArray(__spreadArray([], h.levels, true), [
                            {
                                dataset_id: 0,
                                column_name: '',
                                label: "Level ".concat(h.levels.length + 1),
                            },
                        ], false) }) : h;
            });
        });
    }, []);
    var removeLevel = (0, react_1.useCallback)(function (hId, levelIdx) {
        setHierarchies(function (prev) {
            return prev.map(function (h) {
                return h.id === hId
                    ? __assign(__assign({}, h), { levels: h.levels.filter(function (_, i) { return i !== levelIdx; }) }) : h;
            });
        });
    }, []);
    var updateLevel = (0, react_1.useCallback)(function (hId, levelIdx, field, value) {
        setHierarchies(function (prev) {
            return prev.map(function (h) {
                return h.id === hId
                    ? __assign(__assign({}, h), { levels: h.levels.map(function (l, i) {
                            var _a;
                            return i === levelIdx ? __assign(__assign({}, l), (_a = {}, _a[field] = value, _a)) : l;
                        }) }) : h;
            });
        });
    }, []);
    var getColumnsForDataset = (0, react_1.useCallback)(function (datasetId) {
        var _a;
        var ds = datasets.find(function (d) { return d.id === datasetId; });
        return ((_a = ds === null || ds === void 0 ? void 0 : ds.columns) !== null && _a !== void 0 ? _a : []).map(function (c) {
            var _a;
            return ({
                value: c.column_name,
                label: "".concat(c.column_name, " (").concat((_a = c.type) !== null && _a !== void 0 ? _a : '', ")"),
            });
        });
    }, [datasets]);
    var datasetOptions = (0, react_1.useMemo)(function () {
        return datasets.map(function (d) {
            var _a, _b;
            return ({
                value: d.id,
                label: "".concat(d.table_name, " (").concat((_b = (_a = d.database) === null || _a === void 0 ? void 0 : _a.database_name) !== null && _b !== void 0 ? _b : 'DB', ")"),
            });
        });
    }, [datasets]);
    var handleSave = (0, react_1.useCallback)(function () {
        var valid = hierarchies.filter(function (h) { return h.name && h.levels.length >= 2 && h.levels.every(function (l) { return l.dataset_id && l.column_name; }); });
        onSave(valid);
    }, [hierarchies, onSave]);
    return (<>
    {show && (<div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', zIndex: 9999,
            }}>
        <div style={{
                background: '#fff', borderRadius: 8, padding: 24, width: 700,
                maxHeight: '80vh', overflowY: 'auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}>
          <h3 style={{ margin: '0 0 16px 0' }}>Configure Drill-Down Hierarchies</h3>
      <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                maxHeight: '60vh',
                overflowY: 'auto',
            }}>
        {hierarchies.map(function (hierarchy) { return (<div key={hierarchy.id} style={{
                    border: '1px solid #e8e8e8',
                    borderRadius: 4,
                    padding: 12,
                }}>
            <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 8,
                }}>
              <components_1.Input value={hierarchy.name} onChange={function (e) {
                    return updateHierarchyName(hierarchy.id, e.target.value);
                }} placeholder="Hierarchy name (e.g., Geography)" style={{ flex: 1 }}/>
              <components_1.Button buttonSize="xsmall" buttonStyle="danger" onClick={function () { return removeHierarchy(hierarchy.id); }}>
                Remove
              </components_1.Button>
            </div>

            {hierarchy.levels.map(function (level, levelIdx) { return (<div key={levelIdx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 8,
                        paddingLeft: 16,
                    }}>
                <span style={{
                        color: '#999',
                        fontSize: '12px',
                        width: 20,
                    }}>
                  {levelIdx + 1}.
                </span>

                <components_1.Select value={level.dataset_id || undefined} options={datasetOptions} onChange={function (v) {
                        return updateLevel(hierarchy.id, levelIdx, 'dataset_id', v);
                    }} placeholder="Dataset"/>

                <components_1.Select value={level.column_name || undefined} options={level.dataset_id
                        ? getColumnsForDataset(level.dataset_id)
                        : []} onChange={function (v) {
                        return updateLevel(hierarchy.id, levelIdx, 'column_name', v);
                    }} placeholder="Column"/>

                <components_1.Input value={level.label} onChange={function (e) {
                        return updateLevel(hierarchy.id, levelIdx, 'label', e.target.value);
                    }} placeholder="Label" style={{ width: 120 }}/>

                <components_1.Button buttonSize="xsmall" buttonStyle="danger" onClick={function () { return removeLevel(hierarchy.id, levelIdx); }}>
                  ✕
                </components_1.Button>
              </div>); })}

            <components_1.Button buttonSize="xsmall" buttonStyle="tertiary" onClick={function () { return addLevel(hierarchy.id); }} style={{ marginLeft: 16 }}>
              + Add Level
            </components_1.Button>
          </div>); })}

        <components_1.Button buttonSize="small" buttonStyle="primary" onClick={addHierarchy}>
          + Add Hierarchy
        </components_1.Button>
      </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <components_1.Button buttonSize="small" buttonStyle="secondary" onClick={onHide}>Cancel</components_1.Button>
            <components_1.Button buttonSize="small" buttonStyle="primary" onClick={handleSave}>Save Hierarchy</components_1.Button>
          </div>
        </div>
      </div>)}
    </>);
}
exports.default = DrillDownConfigModal;
