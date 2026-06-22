"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSavedMetric = exports.isDatasourcePanelDndItem = void 0;
function isDatasourcePanelDndItem(item) {
    return (item === null || item === void 0 ? void 0 : item.value) && (item === null || item === void 0 ? void 0 : item.type);
}
exports.isDatasourcePanelDndItem = isDatasourcePanelDndItem;
function isSavedMetric(item) {
    return item === null || item === void 0 ? void 0 : item.metric_name;
}
exports.isSavedMetric = isSavedMetric;
