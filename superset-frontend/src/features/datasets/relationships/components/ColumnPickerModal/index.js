"use strict";
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  This ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except be agreed to
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
var core_1 = require("@superset-ui/core");
var components_1 = require("@superset-ui/core/components");
var OPERATOR_OPTIONS = [
    { value: '=', label: '= (equals)' },
    { value: '!=', label: '!= (not equals)' },
    { value: '>', label: '> (greater than)' },
    { value: '<', label: '< (less than)' },
    { value: '>=', label: '>= (greater or equal)' },
    { value: '<=', label: '<= (less or equal)' },
];
function ColumnPickerModal(_a) {
    var _this = this;
    var show = _a.show, sourceDataset = _a.sourceDataset, targetDataset = _a.targetDataset, initialColumns = _a.initialColumns, onSave = _a.onSave, onHide = _a.onHide;
    // Enriched datasets with full column info fetched individually
    var _b = (0, react_1.useState)(null), enrichedSource = _b[0], setEnrichedSource = _b[1];
    var _c = (0, react_1.useState)(null), enrichedTarget = _c[0], setEnrichedTarget = _c[1];
    var _d = (0, react_1.useState)(false), columnsLoading = _d[0], setColumnsLoading = _d[1];
    // When modal opens, fetch full dataset details if columns are missing
    (0, react_1.useEffect)(function () {
        if (!show) {
            setEnrichedSource(null);
            setEnrichedTarget(null);
            return;
        }
        var fetchDataset = function (ds) { return __awaiter(_this, void 0, void 0, function () {
            var json;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!ds)
                            return [2 /*return*/, null];
                        // If columns already present, use as-is
                        if (ds.columns && ds.columns.length > 0)
                            return [2 /*return*/, ds];
                        return [4 /*yield*/, core_1.SupersetClient.get({ endpoint: "/api/v1/dataset/".concat(ds.id) })];
                    case 1:
                        json = (_a.sent()).json;
                        return [2 /*return*/, json];
                }
            });
        }); };
        var cancelled = false;
        setColumnsLoading(true);
        Promise.all([fetchDataset(sourceDataset), fetchDataset(targetDataset)])
            .then(function (_a) {
            var src = _a[0], tgt = _a[1];
            if (!cancelled) {
                setEnrichedSource(src);
                setEnrichedTarget(tgt);
                setColumnsLoading(false);
            }
        })
            .catch(function () {
            if (!cancelled)
                setColumnsLoading(false);
        });
        return function () { cancelled = true; };
    }, [show, sourceDataset, targetDataset]);
    var effectiveSource = enrichedSource !== null && enrichedSource !== void 0 ? enrichedSource : sourceDataset;
    var effectiveTarget = enrichedTarget !== null && enrichedTarget !== void 0 ? enrichedTarget : targetDataset;
    var sourceColumnOptions = (0, react_1.useMemo)(function () {
        var _a;
        return ((_a = effectiveSource === null || effectiveSource === void 0 ? void 0 : effectiveSource.columns) !== null && _a !== void 0 ? _a : []).map(function (c) {
            var _a;
            return ({
                value: c.column_name,
                label: "".concat(c.column_name, " (").concat((_a = c.type) !== null && _a !== void 0 ? _a : '', ")"),
            });
        });
    }, [effectiveSource]);
    var targetColumnOptions = (0, react_1.useMemo)(function () {
        var _a;
        return ((_a = effectiveTarget === null || effectiveTarget === void 0 ? void 0 : effectiveTarget.columns) !== null && _a !== void 0 ? _a : []).map(function (c) {
            var _a;
            return ({
                value: c.column_name,
                label: "".concat(c.column_name, " (").concat((_a = c.type) !== null && _a !== void 0 ? _a : '', ")"),
            });
        });
    }, [effectiveTarget]);
    var _e = (0, react_1.useState)(function () {
        return (initialColumns !== null && initialColumns !== void 0 ? initialColumns : [{ source_column_name: '', target_column_name: '', operator: '=', ordinal: 0 }]).map(function (col, i) { return ({
            id: "pair-".concat(i, "-").concat(Date.now()),
            source_column_name: col.source_column_name,
            target_column_name: col.target_column_name,
            operator: col.operator,
            ordinal: i,
        }); });
    }), pairs = _e[0], setPairs = _e[1];
    var updatePair = (0, react_1.useCallback)(function (pairId, field, value) {
        setPairs(function (prev) {
            return prev.map(function (p) {
                var _a;
                return (p.id === pairId ? __assign(__assign({}, p), (_a = {}, _a[field] = value, _a)) : p);
            });
        });
    }, []);
    var addPair = (0, react_1.useCallback)(function () {
        setPairs(function (prev) { return __spreadArray(__spreadArray([], prev, true), [
            {
                id: "pair-".concat(prev.length, "-").concat(Date.now()),
                source_column_name: '',
                target_column_name: '',
                operator: '=',
                ordinal: prev.length,
            },
        ], false); });
    }, []);
    var removePair = (0, react_1.useCallback)(function (pairId) {
        setPairs(function (prev) { return prev.filter(function (p) { return p.id !== pairId; }); });
    }, []);
    var handleSave = (0, react_1.useCallback)(function () {
        var cleaned = pairs
            .filter(function (p) { return p.source_column_name && p.target_column_name; })
            .map(function (p, i) { return ({
            source_column_name: p.source_column_name,
            target_column_name: p.target_column_name,
            operator: p.operator,
            ordinal: i,
        }); });
        if (cleaned.length > 0) {
            onSave(cleaned);
        }
    }, [pairs, onSave]);
    var isValid = pairs.some(function (p) { return p.source_column_name && p.target_column_name; });
    return (<>
    {show && (<div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', zIndex: 9999,
            }}>
        <div style={{
                background: '#fff', borderRadius: 8, padding: 24, width: 600,
                maxHeight: '80vh', overflowY: 'auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}>
          <h3 style={{ margin: '0 0 16px 0' }}>Configure Column Mappings</h3>
      {columnsLoading ? (<div style={{ textAlign: 'center', padding: 32, color: '#999' }}>
          Loading columns…
        </div>) : (<div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                }}>
        {pairs.map(function (pair) { return (<div key={pair.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: 8,
                        background: '#fafafa',
                        borderRadius: 4,
                    }}>
            <div style={{ flex: 1 }}>
              <div style={{
                        fontSize: '12px',
                        color: '#999',
                        marginBottom: 4,
                    }}>
                Source Column
              </div>
              <components_1.Select value={pair.source_column_name || undefined} options={sourceColumnOptions} onChange={function (v) {
                        return updatePair(pair.id, 'source_column_name', v);
                    }} placeholder="Select column…"/>
            </div>

            <div style={{ width: 100, flexShrink: 0 }}>
              <div style={{
                        fontSize: '12px',
                        color: '#999',
                        marginBottom: 4,
                    }}>
                Operator
              </div>
              <components_1.Select value={pair.operator} options={OPERATOR_OPTIONS} onChange={function (v) {
                        return updatePair(pair.id, 'operator', v);
                    }}/>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{
                        fontSize: '12px',
                        color: '#999',
                        marginBottom: 4,
                    }}>
                Target Column
              </div>
              <components_1.Select value={pair.target_column_name || undefined} options={targetColumnOptions} onChange={function (v) {
                        return updatePair(pair.id, 'target_column_name', v);
                    }} placeholder="Select column…"/>
            </div>

            {pairs.length > 1 && (<components_1.Button buttonSize="xsmall" buttonStyle="danger" onClick={function () { return removePair(pair.id); }} style={{ marginTop: 16 }}>
                ✕
              </components_1.Button>)}
          </div>); })}

        <components_1.Button buttonSize="small" buttonStyle="tertiary" onClick={addPair} style={{ alignSelf: 'flex-start' }}>
          + Add Column Pair
        </components_1.Button>
      </div>)}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <components_1.Button buttonSize="small" buttonStyle="secondary" onClick={onHide}>Cancel</components_1.Button>
            <components_1.Button buttonSize="small" buttonStyle="primary" onClick={handleSave} disabled={!isValid || columnsLoading}>Save Mappings</components_1.Button>
          </div>
        </div>
      </div>)}
    </>);
}
exports.default = ColumnPickerModal;
