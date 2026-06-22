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
exports.useDrillDownNavigation = void 0;
var react_1 = require("react");
// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------
/**
 * Hook that manages drill-down navigation through a hierarchy.
 *
 * Provides:
 * - `drillDown(value)`: navigate one level deeper for a given value
 * - `drillUp(targetLevel)`: navigate back to a specific level
 * - `reset()`: go back to the top level
 * - `breadcrumbs`: current navigation path
 */
function useDrillDownNavigation(hierarchy) {
    var _a = (0, react_1.useState)(null), state = _a[0], setState = _a[1];
    var currentLevel = hierarchy && state
        ? hierarchy.levels[state.currentLevelIndex]
        : null;
    var nextLevel = hierarchy && state && state.currentLevelIndex < hierarchy.levels.length - 1
        ? hierarchy.levels[state.currentLevelIndex + 1]
        : null;
    /**
     * Initialize drill-down for a hierarchy.
     */
    var initDrillDown = (0, react_1.useCallback)(function (h) {
        setState({
            hierarchyId: h.id,
            currentLevelIndex: 0,
            breadcrumbs: [],
            currentFilter: null,
        });
    }, []);
    /**
     * Navigate one level deeper.
     *
     * @param value The value clicked at the current level (e.g., "Brazil")
     */
    var drillDown = (0, react_1.useCallback)(function (value) {
        if (!hierarchy || !state)
            return;
        var nextIdx = state.currentLevelIndex + 1;
        if (nextIdx >= hierarchy.levels.length)
            return;
        var currentLvl = hierarchy.levels[state.currentLevelIndex];
        var nextLvl = hierarchy.levels[nextIdx];
        // Build filter for the next level
        var newFilter = {
            datasetId: nextLvl.dataset_id,
            column: nextLvl.column_name,
            values: [value],
        };
        setState(function (prev) {
            if (!prev)
                return prev;
            return __assign(__assign({}, prev), { currentLevelIndex: nextIdx, breadcrumbs: __spreadArray(__spreadArray([], prev.breadcrumbs, true), [
                    {
                        levelIndex: prev.currentLevelIndex,
                        label: currentLvl.label,
                        value: value,
                        column: currentLvl.column_name,
                        datasetId: currentLvl.dataset_id,
                    },
                ], false), currentFilter: newFilter });
        });
    }, [hierarchy, state]);
    /**
     * Navigate back to a specific level in the breadcrumb.
     */
    var drillUp = (0, react_1.useCallback)(function (targetLevel) {
        if (!state)
            return;
        setState(function (prev) {
            if (!prev)
                return prev;
            return __assign(__assign({}, prev), { currentLevelIndex: targetLevel, breadcrumbs: prev.breadcrumbs.slice(0, targetLevel), currentFilter: targetLevel > 0
                    ? {
                        datasetId: prev.breadcrumbs[targetLevel - 1].datasetId,
                        column: prev.breadcrumbs[targetLevel - 1].column,
                        values: [prev.breadcrumbs[targetLevel - 1].value],
                    }
                    : null });
        });
    }, [state]);
    /**
     * Reset to the top level.
     */
    var reset = (0, react_1.useCallback)(function () {
        if (!hierarchy)
            return;
        setState({
            hierarchyId: hierarchy.id,
            currentLevelIndex: 0,
            breadcrumbs: [],
            currentFilter: null,
        });
    }, [hierarchy]);
    return {
        state: state,
        currentLevel: currentLevel,
        nextLevel: nextLevel,
        canDrillDown: nextLevel !== null,
        initDrillDown: initDrillDown,
        drillDown: drillDown,
        drillUp: drillUp,
        reset: reset,
    };
}
exports.useDrillDownNavigation = useDrillDownNavigation;
