(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /**
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
import React from 'react';import { jsx as ___EmotionJSX } from "@emotion/react";










// first, ..., prev, current, next, ..., last
const MINIMAL_PAGE_ITEM_COUNT = 7;

/**
 * Generate numeric page items around current page.
 *   - Always include first and last page
 *   - Add ellipsis if needed
 */
export function generatePageItems(
total,
current,
width)
{
  if (width < MINIMAL_PAGE_ITEM_COUNT) {
    throw new Error(
    `Must allow at least ${MINIMAL_PAGE_ITEM_COUNT} page items`);

  }
  if (width % 2 === 0) {
    throw new Error(`Must allow odd number of page items`);
  }
  if (total < width) {
    return [...new Array(total).keys()];
  }
  const left = Math.max(
  0,
  Math.min(total - width, current - Math.floor(width / 2)));

  const items = new Array(width);
  for (let i = 0; i < width; i += 1) {
    items[i] = i + left;
  }
  // replace non-ending items with placeholders
  if (items[0] > 0) {
    items[0] = 0;
    items[1] = 'prev-more';
  }
  if (items[items.length - 1] < total - 1) {
    items[items.length - 1] = total - 1;
    items[items.length - 2] = 'next-more';
  }
  return items;
}const _default = /*#__PURE__*/

React.memo( /*#__PURE__*/
React.forwardRef(function Pagination(
{
  style,
  pageCount,
  currentPage = 0,
  maxPageItemCount = 9,
  onPageChange },

ref)
{
  const pageItems = generatePageItems(
  pageCount,
  currentPage,
  maxPageItemCount);

  return (
    ___EmotionJSX("div", { ref: ref, className: "dt-pagination", style: style },
    ___EmotionJSX("ul", { className: "pagination pagination-sm" },
    pageItems.map((item) =>
    typeof item === 'number' ?
    // actual page number
    ___EmotionJSX("li", {
      key: item,
      className: currentPage === item ? 'active' : undefined },

    ___EmotionJSX("a", {
      href: `#page-${item}`,
      role: "button",
      onClick: (e) => {
        e.preventDefault();
        onPageChange(item);
      } },

    item + 1)) :



    ___EmotionJSX("li", { key: item, className: "dt-pagination-ellipsis" },
    ___EmotionJSX("span", null, "\u2026"))))));






}));export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(MINIMAL_PAGE_ITEM_COUNT, "MINIMAL_PAGE_ITEM_COUNT", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/DataTable/components/Pagination.tsx");reactHotLoader.register(generatePageItems, "generatePageItems", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/DataTable/components/Pagination.tsx");reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/DataTable/components/Pagination.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();