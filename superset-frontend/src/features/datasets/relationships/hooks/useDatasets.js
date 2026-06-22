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
exports.useDataset = exports.useDatasetColumnsEnricher = exports.useDatasetList = void 0;
var react_1 = require("react");
var core_1 = require("@superset-ui/core");
var actions_1 = require("src/components/MessageToasts/actions");
/**
 * Fetch a lightweight list of datasets (id, name, database, columns)
 * for use in the relationship graph canvas.
 */
function useDatasetList() {
    var _this = this;
    var _a = (0, react_1.useState)([]), datasets = _a[0], setDatasets = _a[1];
    var _b = (0, react_1.useState)(false), loading = _b[0], setLoading = _b[1];
    var fetch = (0, react_1.useCallback)(function () { return __awaiter(_this, void 0, void 0, function () {
        var json, result, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setLoading(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, core_1.SupersetClient.get({
                            endpoint: '/api/v1/dataset/?q=(order_column:changed_on_delta_humanized,order_direction:desc,page:0,page_size:500)',
                        })];
                case 2:
                    json = (_a.sent()).json;
                    result = json.result;
                    setDatasets(result);
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _a.sent();
                    (0, actions_1.addDangerToast)('Error fetching datasets.');
                    throw err_1;
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); }, []);
    (0, react_1.useEffect)(function () {
        fetch();
    }, [fetch]);
    return { datasets: datasets, loading: loading, refresh: fetch };
}
exports.useDatasetList = useDatasetList;
/**
 * Fetch full dataset details (including columns) for specific dataset IDs.
 * Returns enriched dataset objects with columns populated.
 */
function useDatasetColumnsEnricher() {
    var _this = this;
    var cacheRef = (0, react_1.useRef)(new Map());
    var enrichDatasets = (0, react_1.useCallback)(function (datasets) { return __awaiter(_this, void 0, void 0, function () {
        var toFetch, results, enrichedMap;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    toFetch = datasets.filter(function (d) { return !d.columns || d.columns.length === 0; });
                    if (toFetch.length === 0)
                        return [2 /*return*/, datasets];
                    return [4 /*yield*/, Promise.allSettled(toFetch.map(function (ds) { return __awaiter(_this, void 0, void 0, function () {
                            var json, full;
                            var _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        // Check cache first
                                        if (cacheRef.current.has(ds.id)) {
                                            return [2 /*return*/, cacheRef.current.get(ds.id)];
                                        }
                                        return [4 /*yield*/, core_1.SupersetClient.get({
                                                endpoint: "/api/v1/dataset/".concat(ds.id),
                                            })];
                                    case 1:
                                        json = (_b.sent()).json;
                                        full = (_a = json.result) !== null && _a !== void 0 ? _a : json;
                                        cacheRef.current.set(ds.id, full);
                                        return [2 /*return*/, full];
                                }
                            });
                        }); }))];
                case 1:
                    results = _a.sent();
                    enrichedMap = new Map();
                    results.forEach(function (r, i) {
                        if (r.status === 'fulfilled') {
                            enrichedMap.set(toFetch[i].id, r.value);
                        }
                    });
                    return [2 /*return*/, datasets.map(function (ds) { var _a; return (_a = enrichedMap.get(ds.id)) !== null && _a !== void 0 ? _a : ds; })];
            }
        });
    }); }, []);
    return { enrichDatasets: enrichDatasets };
}
exports.useDatasetColumnsEnricher = useDatasetColumnsEnricher;
/**
 * Fetch a single dataset with full column info.
 */
function useDataset(datasetId) {
    var _a = (0, react_1.useState)(null), dataset = _a[0], setDataset = _a[1];
    var _b = (0, react_1.useState)(false), loading = _b[0], setLoading = _b[1];
    (0, react_1.useEffect)(function () {
        if (datasetId === null) {
            setDataset(null);
            return;
        }
        setLoading(true);
        core_1.SupersetClient.get({
            endpoint: "/api/v1/dataset/".concat(datasetId),
        })
            .then(function (_a) {
            var json = _a.json;
            setDataset(json);
        })
            .catch(function () {
            (0, actions_1.addDangerToast)('Error fetching dataset.');
        })
            .finally(function () { return setLoading(false); });
    }, [datasetId]);
    return { dataset: dataset, loading: loading };
}
exports.useDataset = useDataset;
