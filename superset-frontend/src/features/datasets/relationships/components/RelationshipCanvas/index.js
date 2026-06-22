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
var react_2 = require("@xyflow/react");
require("@xyflow/react/dist/style.css");
var components_1 = require("@superset-ui/core/components");
var DatasetNode_1 = require("../DatasetNode");
var RelationshipEdge_1 = require("../RelationshipEdge");
var RelationshipSidebar_1 = require("../RelationshipSidebar");
var ColumnPickerModal_1 = require("../ColumnPickerModal");
var hooks_1 = require("../../hooks");
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
var nodeTypes = { dataset: DatasetNode_1.DatasetNode };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
var edgeTypes = { relationship: RelationshipEdge_1.RelationshipEdge };
/**
 * Auto-layout algorithm: group datasets by database → schema,
 * lay out in a grid with source datasets left, targets right.
 */
function computeAutoLayout(datasets, relationships, manuallyAddedIds) {
    var relatedIds = new Set();
    relationships.forEach(function (rel) {
        relatedIds.add(rel.source_dataset_id);
        relatedIds.add(rel.target_dataset_id);
    });
    manuallyAddedIds.forEach(function (id) { return relatedIds.add(id); });
    var visible = datasets.filter(function (ds) { return relatedIds.has(ds.id); });
    if (visible.length === 0)
        return [];
    // Build group key: database::schema
    var groupKey = function (ds) { var _a, _b, _c; return "".concat((_b = (_a = ds.database) === null || _a === void 0 ? void 0 : _a.database_name) !== null && _b !== void 0 ? _b : 'unknown', "::").concat((_c = ds.schema) !== null && _c !== void 0 ? _c : 'public'); };
    var groups = new Map();
    visible.forEach(function (ds) {
        var _a;
        var key = groupKey(ds);
        var arr = (_a = groups.get(key)) !== null && _a !== void 0 ? _a : [];
        arr.push(ds);
        groups.set(key, arr);
    });
    var nodes = [];
    var groupX = 0;
    var COLS_PER_GROUP = 4;
    var X_SPACING = 350;
    var Y_SPACING = 340;
    var GROUP_GAP = 80;
    groups.forEach(function (groupDatasets, key) {
        // Sort datasets: those that are sources first, then targets, then rest
        var sorted = __spreadArray([], groupDatasets, true).sort(function (a, b) {
            var aIsSource = relationships.some(function (r) { return r.source_dataset_id === a.id; });
            var bIsSource = relationships.some(function (r) { return r.source_dataset_id === b.id; });
            if (aIsSource && !bIsSource)
                return -1;
            if (!aIsSource && bIsSource)
                return 1;
            return a.table_name.localeCompare(b.table_name);
        });
        sorted.forEach(function (ds, i) {
            nodes.push({
                id: "dataset-".concat(ds.id),
                type: 'dataset',
                position: {
                    x: groupX + (i % COLS_PER_GROUP) * X_SPACING + 50,
                    y: Math.floor(i / COLS_PER_GROUP) * Y_SPACING + 50,
                },
                data: {
                    dataset: ds,
                    label: ds.table_name,
                },
            });
        });
        // Compute next group X position
        var groupWidth = Math.min(sorted.length, COLS_PER_GROUP) * X_SPACING;
        groupX += groupWidth + GROUP_GAP;
    });
    return nodes;
}
function relationshipsToEdges(relationships) {
    return relationships.map(function (rel) {
        var _a;
        return ({
            id: "relationship-".concat(rel.id),
            source: "dataset-".concat(rel.source_dataset_id),
            target: "dataset-".concat(rel.target_dataset_id),
            type: 'relationship',
            data: {
                relationship: rel,
                label: (_a = rel.name) !== null && _a !== void 0 ? _a : "".concat(rel.relationship_type, " (").concat(rel.join_type, ")"),
            },
        });
    });
}
function HierarchicalDatasetSelector(_a) {
    var _b;
    var enrichedDatasets = _a.enrichedDatasets, onAddDataset = _a.onAddDataset, relatedIds = _a.relatedIds, onFilterChange = _a.onFilterChange;
    // Build hierarchical tree: Database → Schema → Datasets
    var tree = (0, react_1.useMemo)(function () {
        var dbMap = new Map();
        enrichedDatasets.forEach(function (ds) {
            var _a, _b, _c;
            var dbName = (_b = (_a = ds.database) === null || _a === void 0 ? void 0 : _a.database_name) !== null && _b !== void 0 ? _b : 'Unknown';
            var schemaName = (_c = ds.schema) !== null && _c !== void 0 ? _c : 'public';
            if (!dbMap.has(dbName)) {
                dbMap.set(dbName, new Map());
            }
            var schemaMap = dbMap.get(dbName);
            if (!schemaMap.has(schemaName)) {
                schemaMap.set(schemaName, []);
            }
            schemaMap.get(schemaName).push(ds);
        });
        var result = [];
        dbMap.forEach(function (schemaMap, dbName) {
            var schemas = [];
            schemaMap.forEach(function (datasets, schema) {
                schemas.push({
                    schema: schema,
                    datasets: datasets.sort(function (a, b) { return a.table_name.localeCompare(b.table_name); }),
                    collapsed: false,
                });
            });
            result.push({
                dbName: dbName,
                schemas: schemas.sort(function (a, b) { return a.schema.localeCompare(b.schema); }),
                collapsed: false,
            });
        });
        return result.sort(function (a, b) { return a.dbName.localeCompare(b.dbName); });
    }, [enrichedDatasets]);
    var _c = (0, react_1.useState)(new Set()), collapsedDbs = _c[0], setCollapsedDbs = _c[1];
    var _d = (0, react_1.useState)(new Set()), collapsedSchemas = _d[0], setCollapsedSchemas = _d[1];
    var _e = (0, react_1.useState)(undefined), selectedDb = _e[0], setSelectedDb = _e[1];
    var _f = (0, react_1.useState)(undefined), selectedSchema = _f[0], setSelectedSchema = _f[1];
    var toggleDb = (0, react_1.useCallback)(function (dbName) {
        setCollapsedDbs(function (prev) {
            var next = new Set(prev);
            if (next.has(dbName))
                next.delete(dbName);
            else
                next.add(dbName);
            return next;
        });
    }, []);
    var toggleSchema = (0, react_1.useCallback)(function (schemaKey) {
        setCollapsedSchemas(function (prev) {
            var next = new Set(prev);
            if (next.has(schemaKey))
                next.delete(schemaKey);
            else
                next.add(schemaKey);
            return next;
        });
    }, []);
    var handleDbClick = (0, react_1.useCallback)(function (dbName) {
        var newDb = selectedDb === dbName ? undefined : dbName;
        setSelectedDb(newDb);
        setSelectedSchema(undefined);
        onFilterChange(newDb, undefined);
    }, [selectedDb, onFilterChange]);
    var handleSchemaClick = (0, react_1.useCallback)(function (dbName, schema) {
        var newSchema = selectedDb === dbName && selectedSchema === schema ? undefined : schema;
        setSelectedSchema(newSchema);
        onFilterChange(selectedDb, newSchema);
    }, [selectedDb, selectedSchema, onFilterChange]);
    return (<div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            fontSize: '12px',
        }}>
      <div style={{
            fontSize: '11px',
            color: '#999',
            marginBottom: 4,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
        }}>
        Datasets
      </div>

      {/* Collapsible Quick Select */}
      <div style={{
            marginBottom: 8,
            borderBottom: '1px solid #f0f0f0',
            paddingBottom: 4,
        }}>
        {/* Database filter controls */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          {tree.map(function (db) { return (<button key={db.dbName} type="button" onClick={function () { return handleDbClick(db.dbName); }} style={{
                fontSize: '10px',
                padding: '2px 6px',
                border: "1px solid ".concat(selectedDb === db.dbName ? '#2893B3' : '#e0e0e0'),
                borderRadius: 4,
                background: selectedDb === db.dbName ? '#e0f0f5' : '#fafafa',
                color: selectedDb === db.dbName ? '#1a6d85' : '#666',
                cursor: 'pointer',
                fontWeight: selectedDb === db.dbName ? 600 : 400,
            }}>
              {db.dbName}
            </button>); })}
        </div>

        {/* Schema filters (shown when DB is selected) */}
        {selectedDb && (<div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
            {(_b = tree
                .find(function (db) { return db.dbName === selectedDb; })) === null || _b === void 0 ? void 0 : _b.schemas.map(function (sch) { return (<button key={"".concat(selectedDb, "-").concat(sch.schema)} type="button" onClick={function () { return handleSchemaClick(selectedDb, sch.schema); }} style={{
                    fontSize: '9px',
                    padding: '1px 5px',
                    border: "1px solid ".concat(selectedSchema === sch.schema ? '#2893B3' : '#e0e0e0'),
                    borderRadius: 3,
                    background: selectedSchema === sch.schema ? '#e0f0f5' : '#fafafa',
                    color: selectedSchema === sch.schema ? '#1a6d85' : '#888',
                    cursor: 'pointer',
                    fontWeight: selectedSchema === sch.schema ? 600 : 400,
                }}>
                  {sch.schema}
                </button>); })}
          </div>)}
      </div>

      {/* Dataset tree */}
      <div style={{
            maxHeight: 300,
            overflowY: 'auto',
            border: '1px solid #e8e8e8',
            borderRadius: 6,
            background: '#fff',
        }}>
        {tree.map(function (db) {
            var isDbCollapsed = collapsedDbs.has(db.dbName);
            var isDbSelected = selectedDb === db.dbName;
            return (<div key={db.dbName}>
              {/* Database header */}
              <div onClick={function () { return toggleDb(db.dbName); }} style={{
                    padding: '6px 10px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: isDbSelected ? '#1a6d85' : '#555',
                    background: isDbSelected ? '#e0f0f5' : '#fafafa',
                    borderBottom: '1px solid #f0f0f0',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    userSelect: 'none',
                }}>
                <span style={{ fontSize: '10px', color: '#999', width: 14 }}>
                  {isDbCollapsed ? '▶' : '▼'}
                </span>
                <span style={{ flex: 1 }}>{db.dbName}</span>
                <span style={{
                    fontSize: '10px',
                    color: '#999',
                    background: '#f0f0f0',
                    padding: '0 5px',
                    borderRadius: 8,
                }}>
                  {db.schemas.reduce(function (sum, s) { return sum + s.datasets.length; }, 0)}
                </span>
              </div>

              {/* Schema items (collapsible) */}
              {!isDbCollapsed &&
                    db.schemas.map(function (sch) {
                        var schemaKey = "".concat(db.dbName, "-").concat(sch.schema);
                        var isSchCollapsed = collapsedSchemas.has(schemaKey);
                        var isSchemaSelected = selectedDb === db.dbName && selectedSchema === sch.schema;
                        return (<div key={schemaKey}>
                      {/* Schema header */}
                      <div onClick={function () { return toggleSchema(schemaKey); }} style={{
                                padding: '4px 10px 4px 24px',
                                fontSize: '10px',
                                color: '#888',
                                background: isSchemaSelected ? '#f0f7fa' : '#fff',
                                borderBottom: '1px solid #f5f5f5',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                userSelect: 'none',
                            }}>
                        <span style={{ fontSize: '8px', color: '#ccc', width: 12 }}>
                          {isSchCollapsed ? '▶' : '▼'}
                        </span>
                        <span>{sch.schema}</span>
                        <span style={{
                                fontSize: '9px',
                                color: '#bbb',
                                marginLeft: 'auto',
                            }}>
                          {sch.datasets.length} datasets
                        </span>
                      </div>

                      {/* Dataset items (collapsible) */}
                      {!isSchCollapsed &&
                                sch.datasets.map(function (ds) {
                                    var isAdded = relatedIds.has(ds.id);
                                    return (<div key={ds.id} onClick={function () {
                                            if (!isAdded) {
                                                onAddDataset(ds.id);
                                            }
                                        }} style={{
                                            padding: '4px 10px 4px 36px',
                                            fontSize: '11px',
                                            cursor: isAdded ? 'default' : 'pointer',
                                            background: isAdded ? '#f9f9f9' : '#fff',
                                            color: isAdded ? '#bbb' : '#444',
                                            borderBottom: '1px solid #f5f5f5',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 4,
                                            transition: 'background 0.1s ease',
                                        }} onMouseEnter={function (e) {
                                            if (!isAdded) {
                                                e.currentTarget.style.background = '#e0f0f5';
                                            }
                                        }} onMouseLeave={function (e) {
                                            if (!isAdded) {
                                                e.currentTarget.style.background = '#fff';
                                            }
                                        }}>
                              <span style={{
                                            width: 6,
                                            height: 6,
                                            borderRadius: '50%',
                                            background: isAdded ? '#52c41a' : '#e0e0e0',
                                            display: 'inline-block',
                                            flexShrink: 0,
                                        }}/>
                              <span style={{
                                            flex: 1,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}>
                                {ds.table_name}
                              </span>
                              {isAdded && (<span style={{
                                                fontSize: '9px',
                                                color: '#52c41a',
                                            }}>
                                  ✓
                                </span>)}
                            </div>);
                                })}
                    </div>);
                    })}
            </div>);
        })}

        {tree.length === 0 && (<div style={{ padding: 16, color: '#999', fontSize: '12px', textAlign: 'center' }}>
            No datasets available.
          </div>)}
      </div>
    </div>);
}
function RelationshipCanvas(_a) {
    var _this = this;
    var _b, _c, _d, _e, _f, _g;
    var datasetId = _a.datasetId, onClose = _a.onClose;
    var reactFlowWrapper = (0, react_1.useRef)(null);
    // Data hooks
    var _h = (0, hooks_1.useRelationships)(datasetId), relationships = _h.relationships, relLoading = _h.loading, refreshRelationships = _h.refresh;
    var _j = (0, hooks_1.useDatasetList)(), datasets = _j.datasets, dsLoading = _j.loading;
    var enrichDatasets = (0, hooks_1.useDatasetColumnsEnricher)().enrichDatasets;
    var create = (0, hooks_1.useCreateRelationship)().create;
    var update = (0, hooks_1.useUpdateRelationship)().update;
    var remove = (0, hooks_1.useDeleteRelationship)().remove;
    var _k = (0, react_1.useState)(new Set()), manuallyAddedIds = _k[0], setManuallyAddedIds = _k[1];
    var _l = (0, react_1.useState)([]), enrichedDatasets = _l[0], setEnrichedDatasets = _l[1];
    var _m = (0, react_1.useState)(undefined), filterDb = _m[0], setFilterDb = _m[1];
    var _o = (0, react_1.useState)(undefined), filterSchema = _o[0], setFilterSchema = _o[1];
    // Enrich datasets with columns when they change
    (0, react_1.useEffect)(function () {
        if (dsLoading)
            return;
        enrichDatasets(datasets).then(setEnrichedDatasets);
    }, [datasets, dsLoading, enrichDatasets]);
    // Filter handler from hierarchical selector
    var handleFilterChange = (0, react_1.useCallback)(function (db, schema) {
        setFilterDb(db);
        setFilterSchema(schema);
    }, []);
    // Filter datasets by selected database + schema
    var filteredDatasets = (0, react_1.useMemo)(function () {
        if (!filterDb || !filterSchema)
            return enrichedDatasets;
        return enrichedDatasets.filter(function (ds) {
            var _a, _b;
            return ((_a = ds.database) === null || _a === void 0 ? void 0 : _a.database_name) === filterDb &&
                ((_b = ds.schema) !== null && _b !== void 0 ? _b : 'public') === filterSchema;
        });
    }, [enrichedDatasets, filterDb, filterSchema]);
    // Filter relationships to only those involving visible datasets
    var filteredRelationships = (0, react_1.useMemo)(function () {
        if (!filterDb || !filterSchema)
            return relationships;
        var visibleIds = new Set(filteredDatasets.map(function (ds) { return ds.id; }));
        return relationships.filter(function (r) { return visibleIds.has(r.source_dataset_id) && visibleIds.has(r.target_dataset_id); });
    }, [relationships, filteredDatasets, filterDb, filterSchema]);
    var loading = relLoading || dsLoading;
    var initialNodes = (0, react_1.useMemo)(function () { return computeAutoLayout(filteredDatasets, filteredRelationships, manuallyAddedIds); }, [filteredDatasets, filteredRelationships, manuallyAddedIds]);
    var initialEdges = (0, react_1.useMemo)(function () { return relationshipsToEdges(filteredRelationships); }, [filteredRelationships]);
    var _p = (0, react_2.useNodesState)(initialNodes), nodes = _p[0], setNodes = _p[1], onNodesChange = _p[2];
    var _q = (0, react_2.useEdgesState)(initialEdges), edges = _q[0], setEdges = _q[1], onEdgesChange = _q[2];
    (0, react_1.useEffect)(function () {
        setNodes(computeAutoLayout(filteredDatasets, filteredRelationships, manuallyAddedIds));
        setEdges(relationshipsToEdges(relationships));
    }, [filteredDatasets, filteredRelationships, manuallyAddedIds, setNodes, setEdges, relationships]);
    // Dataset selector: compute related IDs for showing "added" state
    var relatedIds = (0, react_1.useMemo)(function () {
        var ids = new Set();
        relationships.forEach(function (rel) {
            ids.add(rel.source_dataset_id);
            ids.add(rel.target_dataset_id);
        });
        manuallyAddedIds.forEach(function (id) { return ids.add(id); });
        return ids;
    }, [relationships, manuallyAddedIds]);
    var handleAddDataset = (0, react_1.useCallback)(function (id) {
        setManuallyAddedIds(function (prev) { return new Set(prev).add(id); });
    }, []);
    var _r = (0, react_1.useState)(null), selectedRelationship = _r[0], setSelectedRelationship = _r[1];
    var _s = (0, react_1.useState)(null), selectedEdgeId = _s[0], setSelectedEdgeId = _s[1];
    // Pending connection - now includes optional pre-selected column names
    var _t = (0, react_1.useState)(null), pendingConnection = _t[0], setPendingConnection = _t[1];
    var _u = (0, react_1.useState)(false), showNewRelPicker = _u[0], setShowNewRelPicker = _u[1];
    var getRelationshipByEdgeId = (0, react_1.useCallback)(function (edgeId) {
        var _a;
        var relId = parseInt(edgeId.replace('relationship-', ''), 10);
        return (_a = relationships.find(function (r) { return r.id === relId; })) !== null && _a !== void 0 ? _a : null;
    }, [relationships]);
    var onEdgeClick = (0, react_1.useCallback)(function (_event, edge) {
        var rel = getRelationshipByEdgeId(edge.id);
        setSelectedRelationship(rel);
        setSelectedEdgeId(edge.id);
    }, [getRelationshipByEdgeId]);
    /**
     * Handle column-level connections.
     * Handle IDs are formatted as:
     *   source-{datasetId}-{columnName}
     *   target-{datasetId}-{columnName}
     */
    var onConnect = (0, react_1.useCallback)(function (connection) { return __awaiter(_this, void 0, void 0, function () {
        var sourceId, targetId, sourceColumn, targetColumn, parts, parts, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!connection.source || !connection.target)
                        return [2 /*return*/];
                    sourceId = parseInt(connection.source.replace('dataset-', ''), 10);
                    targetId = parseInt(connection.target.replace('dataset-', ''), 10);
                    if (connection.sourceHandle) {
                        parts = connection.sourceHandle.split('-');
                        if (parts.length >= 3) {
                            sourceColumn = parts.slice(2).join('-');
                        }
                    }
                    if (connection.targetHandle) {
                        parts = connection.targetHandle.split('-');
                        if (parts.length >= 3) {
                            targetColumn = parts.slice(2).join('-');
                        }
                    }
                    if (!(sourceColumn && targetColumn)) return [3 /*break*/, 5];
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, create({
                            source_dataset_id: sourceId,
                            target_dataset_id: targetId,
                            relationship_type: 'many_to_one',
                            join_type: 'LEFT',
                            name: "".concat(sourceColumn, " \u2192 ").concat(targetColumn),
                            columns: [{
                                    source_column_name: sourceColumn,
                                    target_column_name: targetColumn,
                                    operator: '=',
                                    ordinal: 0,
                                }],
                        })];
                case 2:
                    _b.sent();
                    refreshRelationships();
                    return [3 /*break*/, 4];
                case 3:
                    _a = _b.sent();
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
                case 5:
                    // Fallback: if columns not identified from handles, show picker modal
                    setPendingConnection({ sourceId: sourceId, targetId: targetId, sourceColumn: sourceColumn, targetColumn: targetColumn });
                    setShowNewRelPicker(true);
                    return [2 /*return*/];
            }
        });
    }); }, [create, refreshRelationships]);
    var handleCreateRelationship = (0, react_1.useCallback)(function (columns) { return __awaiter(_this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!pendingConnection)
                        return [2 /*return*/];
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, create({
                            source_dataset_id: pendingConnection.sourceId,
                            target_dataset_id: pendingConnection.targetId,
                            relationship_type: 'many_to_one',
                            join_type: 'LEFT',
                            columns: columns,
                        })];
                case 2:
                    _b.sent();
                    refreshRelationships();
                    setShowNewRelPicker(false);
                    setPendingConnection(null);
                    return [3 /*break*/, 4];
                case 3:
                    _a = _b.sent();
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); }, [pendingConnection, create, refreshRelationships]);
    var handleUpdateRelationship = (0, react_1.useCallback)(function (id, data) { return __awaiter(_this, void 0, void 0, function () {
        var updated, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, update(id, data)];
                case 1:
                    _b.sent();
                    refreshRelationships();
                    updated = relationships.find(function (r) { return r.id === id; });
                    if (updated) {
                        setSelectedRelationship(__assign(__assign({}, updated), data));
                    }
                    return [3 /*break*/, 3];
                case 2:
                    _a = _b.sent();
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); }, [update, refreshRelationships, relationships]);
    var handleDeleteRelationship = (0, react_1.useCallback)(function (id) { return __awaiter(_this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, remove(id)];
                case 1:
                    _b.sent();
                    setSelectedRelationship(null);
                    setSelectedEdgeId(null);
                    refreshRelationships();
                    return [3 /*break*/, 3];
                case 2:
                    _a = _b.sent();
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); }, [remove, refreshRelationships]);
    var onPaneClick = (0, react_1.useCallback)(function () {
        setSelectedRelationship(null);
        setSelectedEdgeId(null);
    }, []);
    var sourceDs = selectedRelationship
        ? (_b = enrichedDatasets.find(function (d) { return d.id === selectedRelationship.source_dataset_id; })) !== null && _b !== void 0 ? _b : null
        : pendingConnection
            ? (_c = enrichedDatasets.find(function (d) { return d.id === pendingConnection.sourceId; })) !== null && _c !== void 0 ? _c : null
            : null;
    var targetDs = selectedRelationship
        ? (_d = enrichedDatasets.find(function (d) { return d.id === selectedRelationship.target_dataset_id; })) !== null && _d !== void 0 ? _d : null
        : pendingConnection
            ? (_e = enrichedDatasets.find(function (d) { return d.id === pendingConnection.targetId; })) !== null && _e !== void 0 ? _e : null
            : null;
    // Build initial columns from column-level drag if present
    var pickerInitialColumns = (0, react_1.useMemo)(function () {
        if (!(pendingConnection === null || pendingConnection === void 0 ? void 0 : pendingConnection.sourceColumn) || !(pendingConnection === null || pendingConnection === void 0 ? void 0 : pendingConnection.targetColumn)) {
            return undefined;
        }
        return [{
                source_column_name: pendingConnection.sourceColumn,
                target_column_name: pendingConnection.targetColumn,
                operator: '=',
                ordinal: 0,
            }];
    }, [pendingConnection]);
    // Auto-layout handler
    var handleAutoLayout = (0, react_1.useCallback)(function () {
        setNodes(computeAutoLayout(filteredDatasets, filteredRelationships, manuallyAddedIds));
    }, [filteredDatasets, filteredRelationships, manuallyAddedIds, setNodes]);
    if (loading) {
        return (<div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 400,
                color: '#999',
            }}>
        Loading relationships…
      </div>);
    }
    return (<div style={{
            display: 'flex',
            height: '100%',
            minHeight: 500,
            border: '1px solid #e8e8e8',
            borderRadius: 4,
            overflow: 'hidden',
        }}>
      {/* Sidebar LEFT */}
      {(!selectedRelationship || !selectedEdgeId) && (<div style={{
                width: 320,
                borderRight: '1px solid #e8e8e8',
                background: '#fafafa',
                overflowY: 'hidden',
                display: 'flex',
                flexDirection: 'column',
            }}>
          {/* Hierarchical Add Dataset selector */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8e8e8', flexShrink: 0 }}>
            <HierarchicalDatasetSelector enrichedDatasets={enrichedDatasets} onAddDataset={handleAddDataset} relatedIds={relatedIds} onFilterChange={handleFilterChange}/>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <RelationshipSidebar_1.default relationship={selectedRelationship} sourceDataset={sourceDs} targetDataset={targetDs} allRelationships={relationships} allDatasets={enrichedDatasets} onUpdate={handleUpdateRelationship} onDelete={handleDeleteRelationship} onClose={function () {
                setSelectedRelationship(null);
                setSelectedEdgeId(null);
            }} onSelectRelationship={function (rel) {
                setSelectedRelationship(rel);
                setSelectedEdgeId("relationship-".concat(rel.id));
            }} pendingConnection={pendingConnection ? { sourceId: pendingConnection.sourceId, targetId: pendingConnection.targetId } : null} onCreateFromPending={handleCreateRelationship} onCancelPending={function () {
                setPendingConnection(null);
                setShowNewRelPicker(false);
            }}/>
          </div>
        </div>)}

      {/* Canvas area */}
      <div ref={reactFlowWrapper} style={{ flex: 1, height: '100%', position: 'relative' }}>
        {/* Auto Layout button */}
        <div style={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 5,
        }}>
          <components_1.Button buttonSize="xsmall" buttonStyle="tertiary" onClick={handleAutoLayout} style={{
            fontSize: '11px',
            background: '#fff',
            border: '1px solid #d9d9d9',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        }}>
            Auto Layout
          </components_1.Button>
        </div>

        <react_2.ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onEdgeClick={onEdgeClick} onPaneClick={onPaneClick} nodeTypes={nodeTypes} edgeTypes={edgeTypes} connectOnClick={false} fitView fitViewOptions={{ padding: 0.2 }} style={{ background: '#fafafa' }}>
          <react_2.Controls style={{
            borderRadius: 8,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}/>
          <react_2.MiniMap nodeColor={function (n) {
            var _a, _b;
            var ds = (_a = n === null || n === void 0 ? void 0 : n.data) === null || _a === void 0 ? void 0 : _a.dataset;
            if ((_b = ds === null || ds === void 0 ? void 0 : ds.database) === null || _b === void 0 ? void 0 : _b.database_name) {
                // Use database name for color
                var hash = 0;
                for (var i = 0; i < ds.database.database_name.length; i++) {
                    hash = ds.database.database_name.charCodeAt(i) + ((hash << 5) - hash);
                }
                var hue = Math.abs(hash) % 360;
                return "hsl(".concat(hue, ", 50%, 60%)");
            }
            return n.selected ? '#2893B3' : '#ccc';
        }} style={{
            background: '#fafafa',
            border: '1px solid #ddd',
            borderRadius: 6,
        }}/>
          <react_2.Background variant={react_2.BackgroundVariant.Dots} gap={20} size={1} color="#e0e0e0"/>
        </react_2.ReactFlow>
      </div>

      {/* New Relationship Column Picker */}
      <ColumnPickerModal_1.default show={showNewRelPicker} sourceDataset={pendingConnection
            ? (_f = enrichedDatasets.find(function (d) { return d.id === pendingConnection.sourceId; })) !== null && _f !== void 0 ? _f : null
            : null} targetDataset={pendingConnection
            ? (_g = enrichedDatasets.find(function (d) { return d.id === pendingConnection.targetId; })) !== null && _g !== void 0 ? _g : null
            : null} initialColumns={pickerInitialColumns} onSave={handleCreateRelationship} onHide={function () {
            setShowNewRelPicker(false);
            setPendingConnection(null);
        }}/>
    </div>);
}
exports.default = RelationshipCanvas;
