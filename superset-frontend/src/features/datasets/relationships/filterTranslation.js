"use strict";
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file that was agreed to
 * by you in writing, software distributed under the License
 * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
 * CONDITIONS OF ANY KIND, either express or implied.  See
 * the License for the specific language governing permissions
 * and limitations under the License.
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterTranslationEngine = exports.FilterTranslationEngine = void 0;
var core_1 = require("@superset-ui/core");
// ---------------------------------------------------------------------------
// Filter Translation Engine
// ---------------------------------------------------------------------------
/**
 * Translates filter values from one dataset to another via relationship mappings.
 *
 * For same-database relationships: the filter is directly applicable because
 * the JOIN happens at the SQL level — no translation needed.
 *
 * For cross-database relationships: we fetch the distinct values from the
 * target dataset's join column that correspond to the filtered source values.
 */
var FilterTranslationEngine = /** @class */ (function () {
    function FilterTranslationEngine() {
        this.relationshipCache = new Map();
        this.cacheTimestamps = new Map();
    }
    /**
     * Load relationships for a dataset from the API.
     */
    FilterTranslationEngine.prototype.loadRelationships = function (datasetId) {
        return __awaiter(this, void 0, void 0, function () {
            var cachedAt, json, relationships, _a;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        cachedAt = (_b = this.cacheTimestamps.get(datasetId)) !== null && _b !== void 0 ? _b : 0;
                        if (this.relationshipCache.has(datasetId) &&
                            Date.now() - cachedAt < FilterTranslationEngine.CACHE_TTL_MS) {
                            return [2 /*return*/, this.relationshipCache.get(datasetId)];
                        }
                        this.relationshipCache.delete(datasetId);
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, core_1.SupersetClient.get({
                                endpoint: "/api/v1/dataset_relationship/dataset/".concat(datasetId, "?active_only=true"),
                            })];
                    case 2:
                        json = (_c.sent()).json;
                        relationships = json.result.map(function (rel) {
                            var _a, _b, _c, _d;
                            return ({
                                relationshipId: rel.id,
                                sourceDatasetId: rel.source_dataset_id,
                                targetDatasetId: rel.target_dataset_id,
                                sourceColumn: (_b = (_a = rel.columns[0]) === null || _a === void 0 ? void 0 : _a.source_column_name) !== null && _b !== void 0 ? _b : '',
                                targetColumn: (_d = (_c = rel.columns[0]) === null || _c === void 0 ? void 0 : _c.target_column_name) !== null && _d !== void 0 ? _d : '',
                                relationshipType: rel.relationship_type,
                                joinType: rel.join_type,
                                isCrossDatabase: rel.is_cross_database,
                            });
                        });
                        this.relationshipCache.set(datasetId, relationships);
                        this.cacheTimestamps.set(datasetId, Date.now());
                        return [2 /*return*/, relationships];
                    case 3:
                        _a = _c.sent();
                        return [2 /*return*/, []];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Translate a filter applied on one dataset to all related datasets.
     *
     * @param sourceFilter The filter to translate
     * @returns Array of translated filters for each related dataset
     */
    FilterTranslationEngine.prototype.translateFilter = function (sourceFilter) {
        return __awaiter(this, void 0, void 0, function () {
            var mappings, results, _i, mappings_1, mapping, translated;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, this.loadRelationships(sourceFilter.datasetId)];
                    case 1:
                        mappings = _c.sent();
                        results = [];
                        _i = 0, mappings_1 = mappings;
                        _c.label = 2;
                    case 2:
                        if (!(_i < mappings_1.length)) return [3 /*break*/, 6];
                        mapping = mappings_1[_i];
                        // Only translate if the filter column matches the source join column
                        if (mapping.sourceColumn !== sourceFilter.column) {
                            return [3 /*break*/, 5];
                        }
                        if (!!mapping.isCrossDatabase) return [3 /*break*/, 3];
                        // Same-DB: the JOIN handles the translation at SQL level.
                        // We pass the filter values directly to the target column.
                        results.push({
                            targetDatasetId: mapping.targetDatasetId,
                            targetColumn: mapping.targetColumn,
                            translatedValues: sourceFilter.values,
                            operator: (_a = sourceFilter.operator) !== null && _a !== void 0 ? _a : 'IN',
                            confidence: 'exact',
                        });
                        return [3 /*break*/, 5];
                    case 3: return [4 /*yield*/, this.resolveCrossDbValues(mapping, sourceFilter.values)];
                    case 4:
                        translated = _c.sent();
                        if (translated.length > 0) {
                            results.push({
                                targetDatasetId: mapping.targetDatasetId,
                                targetColumn: mapping.targetColumn,
                                translatedValues: translated,
                                operator: (_b = sourceFilter.operator) !== null && _b !== void 0 ? _b : 'IN',
                                confidence: 'mapped',
                            });
                        }
                        _c.label = 5;
                    case 5:
                        _i++;
                        return [3 /*break*/, 2];
                    case 6: return [2 /*return*/, results];
                }
            });
        });
    };
    /**
     * For cross-DB relationships, resolve target values from source values.
     *
     * This runs a query against the target database to find matching values
     * on the join column that correspond to the filtered source values.
     */
    FilterTranslationEngine.prototype.resolveCrossDbValues = function (mapping, sourceValues) {
        return __awaiter(this, void 0, void 0, function () {
            var json, _a;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, core_1.SupersetClient.post({
                                endpoint: '/api/v1/dataset_relationship/resolve_values/',
                                body: JSON.stringify({
                                    source_dataset_id: mapping.sourceDatasetId,
                                    target_dataset_id: mapping.targetDatasetId,
                                    source_column: mapping.sourceColumn,
                                    target_column: mapping.targetColumn,
                                    source_values: sourceValues,
                                }),
                                headers: { 'Content-Type': 'application/json' },
                            })];
                    case 1:
                        json = (_c.sent()).json;
                        return [2 /*return*/, (_b = json.result) !== null && _b !== void 0 ? _b : []];
                    case 2:
                        _a = _c.sent();
                        return [2 /*return*/, []];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Build a chain of translations for multi-hop relationships.
     * A → B → C: filter on A gets translated to B, then from B to C.
     */
    FilterTranslationEngine.prototype.translateFilterChain = function (sourceFilter_1) {
        return __awaiter(this, arguments, void 0, function (sourceFilter, maxDepth) {
            var allTranslated, queue, visited, depth, currentFilter, translations, _i, translations_1, t;
            if (maxDepth === void 0) { maxDepth = 3; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        allTranslated = [];
                        queue = [sourceFilter];
                        visited = new Set();
                        visited.add(sourceFilter.datasetId);
                        depth = 0;
                        _a.label = 1;
                    case 1:
                        if (!(queue.length > 0 && depth < maxDepth)) return [3 /*break*/, 3];
                        currentFilter = queue.shift();
                        return [4 /*yield*/, this.translateFilter(currentFilter)];
                    case 2:
                        translations = _a.sent();
                        for (_i = 0, translations_1 = translations; _i < translations_1.length; _i++) {
                            t = translations_1[_i];
                            if (!visited.has(t.targetDatasetId)) {
                                allTranslated.push(t);
                                visited.add(t.targetDatasetId);
                                queue.push({
                                    column: t.targetColumn,
                                    datasetId: t.targetDatasetId,
                                    values: t.translatedValues,
                                    operator: t.operator,
                                });
                            }
                        }
                        depth++;
                        return [3 /*break*/, 1];
                    case 3: return [2 /*return*/, allTranslated];
                }
            });
        });
    };
    /**
     * Clear the relationship cache.
     */
    FilterTranslationEngine.prototype.clearCache = function () {
        this.relationshipCache.clear();
        this.cacheTimestamps.clear();
    };
    /**
     * Invalidate cache for a specific dataset.
     * Called after create/update/delete operations on relationships.
     */
    FilterTranslationEngine.prototype.invalidateDataset = function (datasetId) {
        this.relationshipCache.delete(datasetId);
        this.cacheTimestamps.delete(datasetId);
    };
    FilterTranslationEngine.CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
    return FilterTranslationEngine;
}());
exports.FilterTranslationEngine = FilterTranslationEngine;
// Singleton instance for use across the app
exports.filterTranslationEngine = new FilterTranslationEngine();
