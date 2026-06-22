"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.useExploreRelationships = void 0;
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
 * Hook that manages dataset relationships within the Explore view.
 *
 * Takes the relationships array from the Datasource (injected by backend)
 * and provides utilities to:
 * - Look up which relationships involve a given column
 * - Toggle JOINs on/off
 * - Select which target columns to include
 * - Build the form_data fragment to send to the query backend
 */
function useExploreRelationships(relationships) {
    var _this = this;
    var _a = (0, react_1.useState)(function () { return new Map(); }), activeJoins = _a[0], setActiveJoins = _a[1];
    // Build column → relationships lookup
    var columnRelationshipMap = (0, react_1.useMemo)(function () {
        var map = new Map();
        relationships.forEach(function (rel) {
            rel.columns.forEach(function (col) {
                var _a;
                var existing = (_a = map.get(col.source_column_name)) !== null && _a !== void 0 ? _a : [];
                existing.push(rel);
                map.set(col.source_column_name, existing);
            });
        });
        return map;
    }, [relationships]);
    // Build available target columns (column names from the target)
    var availableTargetColumns = (0, react_1.useMemo)(function () {
        var map = new Map();
        // We don't have full target dataset schema here — this will
        // be populated lazily when the user activates a JOIN.
        relationships.forEach(function (rel) {
            if (!map.has(rel.target_dataset_id)) {
                map.set(rel.target_dataset_id, []);
            }
        });
        return map;
    }, [relationships]);
    // Lazy-load target columns when a relationship is activated
    var loadTargetColumns = (0, react_1.useCallback)(function (relationshipId) { return __awaiter(_this, void 0, void 0, function () {
        var rel, SupersetClient, json, cols_1, _a;
        var _b, _c, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    // If already loaded, skip
                    if (((_c = (_b = availableTargetColumns.get(relationshipId)) === null || _b === void 0 ? void 0 : _b.length) !== null && _c !== void 0 ? _c : 0) > 0) {
                        return [2 /*return*/];
                    }
                    rel = relationships.find(function (r) { return r.id === relationshipId; });
                    if (!rel)
                        return [2 /*return*/];
                    _g.label = 1;
                case 1:
                    _g.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('@superset-ui/core'); })];
                case 2:
                    SupersetClient = (_g.sent()).SupersetClient;
                    return [4 /*yield*/, SupersetClient.get({
                            endpoint: "/api/v1/dataset/".concat(rel.target_dataset_id),
                        })];
                case 3:
                    json = (_g.sent()).json;
                    cols_1 = (_f = (_e = (_d = json === null || json === void 0 ? void 0 : json.result) === null || _d === void 0 ? void 0 : _d.columns) === null || _e === void 0 ? void 0 : _e.map(function (c) { return c.column_name; })) !== null && _f !== void 0 ? _f : [];
                    setActiveJoins(function (prev) {
                        var _a;
                        var next = new Map(prev);
                        var existing = (_a = next.get(relationshipId)) !== null && _a !== void 0 ? _a : {
                            relationshipId: relationshipId,
                            selectedColumns: cols_1.slice(0, 5), // default: first 5
                            enabled: false,
                        };
                        existing.selectedColumns = existing.selectedColumns.filter(function (c) {
                            return cols_1.includes(c);
                        });
                        next.set(relationshipId, existing);
                        return next;
                    });
                    // Store available columns
                    setAvailableTargetColumns(function (prev) {
                        var next = new Map(prev);
                        next.set(relationshipId, cols_1);
                        return next;
                    });
                    return [3 /*break*/, 5];
                case 4:
                    _a = _g.sent();
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    }); }, [relationships, availableTargetColumns]);
    // Store available target columns (separate from derived state)
    var _b = (0, react_1.useState)(availableTargetColumns), availableColumnsState = _b[0], setAvailableTargetColumns = _b[1];
    // Toggle a relationship JOIN on/off
    var toggleJoin = (0, react_1.useCallback)(function (relationshipId) { return __awaiter(_this, void 0, void 0, function () {
        var rel;
        return __generator(this, function (_a) {
            rel = relationships.find(function (r) { return r.id === relationshipId; });
            if (!rel)
                return [2 /*return*/];
            setActiveJoins(function (prev) {
                var next = new Map(prev);
                var current = next.get(relationshipId);
                if (current) {
                    next.set(relationshipId, __assign(__assign({}, current), { enabled: !current.enabled }));
                }
                else {
                    // Default: first 5 target columns auto-selected
                    var defaultSelected = rel.columns.map(function (c) { return c.target_column_name; });
                    next.set(relationshipId, {
                        relationshipId: relationshipId,
                        selectedColumns: defaultSelected,
                        enabled: true,
                    });
                    // Eagerly load target columns
                    loadTargetColumns(relationshipId);
                }
                return next;
            });
            return [2 /*return*/];
        });
    }); }, [relationships, loadTargetColumns]);
    // Enable a specific relationship with all target columns
    var enableJoin = (0, react_1.useCallback)(function (relationshipId, targetColumns) { return __awaiter(_this, void 0, void 0, function () {
        var rel;
        return __generator(this, function (_a) {
            rel = relationships.find(function (r) { return r.id === relationshipId; });
            if (!rel)
                return [2 /*return*/];
            setActiveJoins(function (prev) {
                var next = new Map(prev);
                next.set(relationshipId, {
                    relationshipId: relationshipId,
                    selectedColumns: targetColumns !== null && targetColumns !== void 0 ? targetColumns : rel.columns.map(function (c) { return c.target_column_name; }),
                    enabled: true,
                });
                return next;
            });
            if (!targetColumns) {
                loadTargetColumns(relationshipId);
            }
            return [2 /*return*/];
        });
    }); }, [relationships, loadTargetColumns]);
    // Disable a specific relationship
    var disableJoin = (0, react_1.useCallback)(function (relationshipId) {
        setActiveJoins(function (prev) {
            var next = new Map(prev);
            var current = next.get(relationshipId);
            if (current) {
                next.set(relationshipId, __assign(__assign({}, current), { enabled: false }));
            }
            return next;
        });
    }, []);
    // Update selected columns for a relationship
    var updateSelectedColumns = (0, react_1.useCallback)(function (relationshipId, columns) {
        setActiveJoins(function (prev) {
            var next = new Map(prev);
            var current = next.get(relationshipId);
            if (current) {
                next.set(relationshipId, __assign(__assign({}, current), { selectedColumns: columns }));
            }
            return next;
        });
    }, []);
    // Get the ColumnRelationshipInfo for a specific column
    var getColumnInfo = (0, react_1.useCallback)(function (columnName) {
        var _a;
        return ({
            columnName: columnName,
            relationships: (_a = columnRelationshipMap.get(columnName)) !== null && _a !== void 0 ? _a : [],
        });
    }, [columnRelationshipMap]);
    // Find if a column is the source column of any ACTIVE relationship
    var isColumnInActiveJoin = (0, react_1.useCallback)(function (columnName) {
        var _a;
        var rels = (_a = columnRelationshipMap.get(columnName)) !== null && _a !== void 0 ? _a : [];
        return rels.some(function (rel) {
            var join = activeJoins.get(rel.id);
            return (join === null || join === void 0 ? void 0 : join.enabled) === true;
        });
    }, [columnRelationshipMap, activeJoins]);
    // Build the form_data fragment with active relationships
    var buildRelationshipFormData = (0, react_1.useCallback)(function () {
        var activeEntries = [];
        activeJoins.forEach(function (join) {
            if (!join.enabled)
                return;
            var rel = relationships.find(function (r) { return r.id === join.relationshipId; });
            if (!rel)
                return;
            activeEntries.push({
                relationship_id: rel.id,
                join_type: rel.join_type,
                columns: rel.columns,
                selected_columns: join.selectedColumns,
            });
        });
        return activeEntries.length > 0
            ? { active_relationships: activeEntries }
            : {};
    }, [activeJoins, relationships]);
    // Check if any leads to a column with the given name in a relationship
    var findRelationshipByTargetColumn = (0, react_1.useCallback)(function (columnName) {
        return relationships.find(function (rel) {
            return rel.columns.some(function (col) { return col.target_column_name === columnName; });
        });
    }, [relationships]);
    return {
        // State
        activeJoins: activeJoins,
        columnRelationshipMap: columnRelationshipMap,
        availableTargetColumns: availableColumnsState,
        // Queries
        getColumnInfo: getColumnInfo,
        isColumnInActiveJoin: isColumnInActiveJoin,
        findRelationshipByTargetColumn: findRelationshipByTargetColumn,
        // Actions
        toggleJoin: toggleJoin,
        enableJoin: enableJoin,
        disableJoin: disableJoin,
        updateSelectedColumns: updateSelectedColumns,
        loadTargetColumns: loadTargetColumns,
        // Build form_data
        buildRelationshipFormData: buildRelationshipFormData,
    };
}
exports.useExploreRelationships = useExploreRelationships;
