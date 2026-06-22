"use strict";
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
exports.useDeleteRelationship = exports.useUpdateRelationship = exports.useCreateRelationship = exports.useRelationship = exports.useRelationships = void 0;
var react_1 = require("react");
var core_1 = require("@superset-ui/core");
var actions_1 = require("src/components/MessageToasts/actions");
var filterTranslation_1 = require("../filterTranslation");
var API_BASE = '/api/v1/dataset_relationship';
// ---------------------------------------------------------------------------
// GET all relationships (optionally for a dataset)
// ---------------------------------------------------------------------------
function useRelationships(datasetId) {
    var _this = this;
    var _a = (0, react_1.useState)([]), relationships = _a[0], setRelationships = _a[1];
    var _b = (0, react_1.useState)(false), loading = _b[0], setLoading = _b[1];
    var fetch = (0, react_1.useCallback)(function () { return __awaiter(_this, void 0, void 0, function () {
        var endpoint, json, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setLoading(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    endpoint = datasetId
                        ? "".concat(API_BASE, "/dataset/").concat(datasetId)
                        : "".concat(API_BASE, "/");
                    return [4 /*yield*/, core_1.SupersetClient.get({ endpoint: endpoint })];
                case 2:
                    json = (_a.sent()).json;
                    setRelationships(json.result);
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _a.sent();
                    (0, actions_1.addDangerToast)('Error fetching dataset relationships.');
                    throw err_1;
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); }, [datasetId]);
    (0, react_1.useEffect)(function () {
        fetch();
    }, [fetch]);
    return { relationships: relationships, loading: loading, refresh: fetch };
}
exports.useRelationships = useRelationships;
// ---------------------------------------------------------------------------
// GET single relationship
// ---------------------------------------------------------------------------
function useRelationship(relationshipId) {
    var _a = (0, react_1.useState)(null), relationship = _a[0], setRelationship = _a[1];
    var _b = (0, react_1.useState)(false), loading = _b[0], setLoading = _b[1];
    (0, react_1.useEffect)(function () {
        if (relationshipId === null) {
            setRelationship(null);
            return;
        }
        setLoading(true);
        core_1.SupersetClient.get({ endpoint: "".concat(API_BASE, "/").concat(relationshipId) })
            .then(function (_a) {
            var json = _a.json;
            setRelationship(json.result);
        })
            .catch(function () {
            (0, actions_1.addDangerToast)('Error fetching relationship.');
        })
            .finally(function () { return setLoading(false); });
    }, [relationshipId]);
    return { relationship: relationship, loading: loading };
}
exports.useRelationship = useRelationship;
// ---------------------------------------------------------------------------
// POST create relationship
// ---------------------------------------------------------------------------
function useCreateRelationship() {
    var _this = this;
    var _a = (0, react_1.useState)(false), loading = _a[0], setLoading = _a[1];
    var create = (0, react_1.useCallback)(function (data) { return __awaiter(_this, void 0, void 0, function () {
        var json, resp, fullJson, err_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setLoading(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, 5, 6]);
                    return [4 /*yield*/, core_1.SupersetClient.post({
                            endpoint: "".concat(API_BASE, "/"),
                            body: JSON.stringify(data),
                            headers: { 'Content-Type': 'application/json' },
                        })];
                case 2:
                    json = (_a.sent()).json;
                    resp = json;
                    // Invalidate cache for involved datasets
                    filterTranslation_1.filterTranslationEngine.invalidateDataset(data.source_dataset_id);
                    filterTranslation_1.filterTranslationEngine.invalidateDataset(data.target_dataset_id);
                    return [4 /*yield*/, core_1.SupersetClient.get({
                            endpoint: "".concat(API_BASE, "/").concat(resp.id),
                        })];
                case 3:
                    fullJson = (_a.sent()).json;
                    return [2 /*return*/, fullJson.result];
                case 4:
                    err_2 = _a.sent();
                    (0, actions_1.addDangerToast)('Error creating relationship.');
                    throw err_2;
                case 5:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); }, []);
    return { create: create, loading: loading };
}
exports.useCreateRelationship = useCreateRelationship;
// ---------------------------------------------------------------------------
// PUT update relationship
// ---------------------------------------------------------------------------
function useUpdateRelationship() {
    var _this = this;
    var _a = (0, react_1.useState)(false), loading = _a[0], setLoading = _a[1];
    var update = (0, react_1.useCallback)(function (id, data) { return __awaiter(_this, void 0, void 0, function () {
        var json, result, err_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setLoading(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, 5, 6]);
                    return [4 /*yield*/, core_1.SupersetClient.put({
                            endpoint: "".concat(API_BASE, "/").concat(id),
                            body: JSON.stringify(data),
                            headers: { 'Content-Type': 'application/json' },
                        })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, core_1.SupersetClient.get({
                            endpoint: "".concat(API_BASE, "/").concat(id),
                        })];
                case 3:
                    json = (_a.sent()).json;
                    result = json.result;
                    // Invalidate cache for involved datasets
                    filterTranslation_1.filterTranslationEngine.invalidateDataset(result.source_dataset_id);
                    filterTranslation_1.filterTranslationEngine.invalidateDataset(result.target_dataset_id);
                    return [2 /*return*/, result];
                case 4:
                    err_3 = _a.sent();
                    (0, actions_1.addDangerToast)('Error updating relationship.');
                    throw err_3;
                case 5:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); }, []);
    return { update: update, loading: loading };
}
exports.useUpdateRelationship = useUpdateRelationship;
// ---------------------------------------------------------------------------
// DELETE relationship
// ---------------------------------------------------------------------------
function useDeleteRelationship() {
    var _this = this;
    var _a = (0, react_1.useState)(false), loading = _a[0], setLoading = _a[1];
    var remove = (0, react_1.useCallback)(function (id) { return __awaiter(_this, void 0, void 0, function () {
        var json, rel, err_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setLoading(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, 5, 6]);
                    return [4 /*yield*/, core_1.SupersetClient.get({
                            endpoint: "".concat(API_BASE, "/").concat(id),
                        })];
                case 2:
                    json = (_a.sent()).json;
                    rel = json.result;
                    return [4 /*yield*/, core_1.SupersetClient.delete({ endpoint: "".concat(API_BASE, "/").concat(id) })];
                case 3:
                    _a.sent();
                    filterTranslation_1.filterTranslationEngine.invalidateDataset(rel.source_dataset_id);
                    filterTranslation_1.filterTranslationEngine.invalidateDataset(rel.target_dataset_id);
                    return [3 /*break*/, 6];
                case 4:
                    err_4 = _a.sent();
                    (0, actions_1.addDangerToast)('Error deleting relationship.');
                    throw err_4;
                case 5:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); }, []);
    return { remove: remove, loading: loading };
}
exports.useDeleteRelationship = useDeleteRelationship;
