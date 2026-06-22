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
exports.useDashboardRelationshipMetadata = void 0;
var react_1 = require("react");
var core_1 = require("@superset-ui/core");
var actions_1 = require("src/components/MessageToasts/actions");
/**
 * Hook to read/write relationship metadata in dashboard json_metadata.
 */
function useDashboardRelationshipMetadata(dashboardId, initialMetadata) {
    var _this = this;
    var _a = (0, react_1.useState)(initialMetadata !== null && initialMetadata !== void 0 ? initialMetadata : {
        active_relationships: [],
        drill_down_hierarchies: [],
    }), metadata = _a[0], setMetadata = _a[1];
    var updateMetadata = (0, react_1.useCallback)(function (patch) { return __awaiter(_this, void 0, void 0, function () {
        var updated, json, currentMetadata, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!dashboardId)
                        return [2 /*return*/];
                    updated = __assign(__assign({}, metadata), patch);
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, core_1.SupersetClient.get({
                            endpoint: "/api/v1/dashboard/".concat(dashboardId),
                        })];
                case 2:
                    json = (_b.sent()).json;
                    currentMetadata = JSON.parse(json.result.json_metadata || '{}');
                    currentMetadata.relationship_config = updated;
                    return [4 /*yield*/, core_1.SupersetClient.put({
                            endpoint: "/api/v1/dashboard/".concat(dashboardId),
                            body: JSON.stringify({
                                json_metadata: JSON.stringify(currentMetadata),
                            }),
                            headers: { 'Content-Type': 'application/json' },
                        })];
                case 3:
                    _b.sent();
                    setMetadata(updated);
                    return [3 /*break*/, 5];
                case 4:
                    _a = _b.sent();
                    (0, actions_1.addDangerToast)('Error saving dashboard relationship configuration.');
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    }); }, [dashboardId, metadata]);
    var toggleRelationship = (0, react_1.useCallback)(function (relationshipId) { return __awaiter(_this, void 0, void 0, function () {
        var active;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    active = metadata.active_relationships.includes(relationshipId)
                        ? metadata.active_relationships.filter(function (id) { return id !== relationshipId; })
                        : __spreadArray(__spreadArray([], metadata.active_relationships, true), [relationshipId], false);
                    return [4 /*yield*/, updateMetadata({ active_relationships: active })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); }, [metadata.active_relationships, updateMetadata]);
    return {
        metadata: metadata,
        updateMetadata: updateMetadata,
        toggleRelationship: toggleRelationship,
    };
}
exports.useDashboardRelationshipMetadata = useDashboardRelationshipMetadata;
