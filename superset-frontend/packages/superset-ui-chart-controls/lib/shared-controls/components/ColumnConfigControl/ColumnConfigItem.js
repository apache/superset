import { css as _css } from "@emotion/react";(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /**
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
import React from 'react';
import { useTheme } from '@superset-ui/core';
import { Popover } from 'antd';
import ColumnTypeLabel from '../../../components/ColumnTypeLabel';
import ColumnConfigPopover from

'./ColumnConfigPopover';import { jsx as ___EmotionJSX } from "@emotion/react";const _default = /*#__PURE__*/



React.memo(__signature__(function ColumnConfigItem({
  column,
  onChange,
  configFormLayout })
{
  const { colors, gridUnit } = useTheme();
  const caretWidth = gridUnit * 6;
  return (
    ___EmotionJSX(Popover, {
      title: column.name,
      content: () =>
      ___EmotionJSX(ColumnConfigPopover, {
        column: column,
        onChange: onChange,
        configFormLayout: configFormLayout }),


      trigger: "click",
      placement: "right" },

    ___EmotionJSX("div", {
      css: /*#__PURE__*/_css({
        cursor: 'pointer',
        padding: `${1.5 * gridUnit}px ${2 * gridUnit}px`,
        borderBottom: `1px solid ${colors.grayscale.light2}`,
        position: 'relative',
        paddingRight: caretWidth,
        '&:last-child': {
          borderBottom: 'none' },

        '&:hover': {
          background: colors.grayscale.light4 },

        '> .fa': {
          color: colors.grayscale.light2 },

        '&:hover > .fa': {
          color: colors.grayscale.light1 } }, process.env.NODE_ENV === "production" ? "" : "/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9zaGFyZWQtY29udHJvbHMvY29tcG9uZW50cy9Db2x1bW5Db25maWdDb250cm9sL0NvbHVtbkNvbmZpZ0l0ZW0udHN4Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQWlEUSIsImZpbGUiOiIuLi8uLi8uLi8uLi9zcmMvc2hhcmVkLWNvbnRyb2xzL2NvbXBvbmVudHMvQ29sdW1uQ29uZmlnQ29udHJvbC9Db2x1bW5Db25maWdJdGVtLnRzeCIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogTGljZW5zZWQgdG8gdGhlIEFwYWNoZSBTb2Z0d2FyZSBGb3VuZGF0aW9uIChBU0YpIHVuZGVyIG9uZVxuICogb3IgbW9yZSBjb250cmlidXRvciBsaWNlbnNlIGFncmVlbWVudHMuICBTZWUgdGhlIE5PVElDRSBmaWxlXG4gKiBkaXN0cmlidXRlZCB3aXRoIHRoaXMgd29yayBmb3IgYWRkaXRpb25hbCBpbmZvcm1hdGlvblxuICogcmVnYXJkaW5nIGNvcHlyaWdodCBvd25lcnNoaXAuICBUaGUgQVNGIGxpY2Vuc2VzIHRoaXMgZmlsZVxuICogdG8geW91IHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZVxuICogXCJMaWNlbnNlXCIpOyB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlXG4gKiB3aXRoIHRoZSBMaWNlbnNlLiAgWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsXG4gKiBzb2Z0d2FyZSBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhblxuICogXCJBUyBJU1wiIEJBU0lTLCBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTllcbiAqIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuICBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZVxuICogc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZCBsaW1pdGF0aW9uc1xuICogdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cbmltcG9ydCBSZWFjdCBmcm9tICdyZWFjdCc7XG5pbXBvcnQgeyB1c2VUaGVtZSB9IGZyb20gJ0BzdXBlcnNldC11aS9jb3JlJztcbmltcG9ydCB7IFBvcG92ZXIgfSBmcm9tICdhbnRkJztcbmltcG9ydCBDb2x1bW5UeXBlTGFiZWwgZnJvbSAnLi4vLi4vLi4vY29tcG9uZW50cy9Db2x1bW5UeXBlTGFiZWwnO1xuaW1wb3J0IENvbHVtbkNvbmZpZ1BvcG92ZXIsIHtcbiAgQ29sdW1uQ29uZmlnUG9wb3ZlclByb3BzLFxufSBmcm9tICcuL0NvbHVtbkNvbmZpZ1BvcG92ZXInO1xuXG5leHBvcnQgdHlwZSBDb2x1bW5Db25maWdJdGVtUHJvcHMgPSBDb2x1bW5Db25maWdQb3BvdmVyUHJvcHM7XG5cbmV4cG9ydCBkZWZhdWx0IFJlYWN0Lm1lbW8oZnVuY3Rpb24gQ29sdW1uQ29uZmlnSXRlbSh7XG4gIGNvbHVtbixcbiAgb25DaGFuZ2UsXG4gIGNvbmZpZ0Zvcm1MYXlvdXQsXG59OiBDb2x1bW5Db25maWdJdGVtUHJvcHMpIHtcbiAgY29uc3QgeyBjb2xvcnMsIGdyaWRVbml0IH0gPSB1c2VUaGVtZSgpO1xuICBjb25zdCBjYXJldFdpZHRoID0gZ3JpZFVuaXQgKiA2O1xuICByZXR1cm4gKFxuICAgIDxQb3BvdmVyXG4gICAgICB0aXRsZT17Y29sdW1uLm5hbWV9XG4gICAgICBjb250ZW50PXsoKSA9PiAoXG4gICAgICAgIDxDb2x1bW5Db25maWdQb3BvdmVyXG4gICAgICAgICAgY29sdW1uPXtjb2x1bW59XG4gICAgICAgICAgb25DaGFuZ2U9e29uQ2hhbmdlfVxuICAgICAgICAgIGNvbmZpZ0Zvcm1MYXlvdXQ9e2NvbmZpZ0Zvcm1MYXlvdXR9XG4gICAgICAgIC8+XG4gICAgICApfVxuICAgICAgdHJpZ2dlcj1cImNsaWNrXCJcbiAgICAgIHBsYWNlbWVudD1cInJpZ2h0XCJcbiAgICA+XG4gICAgICA8ZGl2XG4gICAgICAgIGNzcz17e1xuICAgICAgICAgIGN1cnNvcjogJ3BvaW50ZXInLFxuICAgICAgICAgIHBhZGRpbmc6IGAkezEuNSAqIGdyaWRVbml0fXB4ICR7MiAqIGdyaWRVbml0fXB4YCxcbiAgICAgICAgICBib3JkZXJCb3R0b206IGAxcHggc29saWQgJHtjb2xvcnMuZ3JheXNjYWxlLmxpZ2h0Mn1gLFxuICAgICAgICAgIHBvc2l0aW9uOiAncmVsYXRpdmUnLFxuICAgICAgICAgIHBhZGRpbmdSaWdodDogY2FyZXRXaWR0aCxcbiAgICAgICAgICAnJjpsYXN0LWNoaWxkJzoge1xuICAgICAgICAgICAgYm9yZGVyQm90dG9tOiAnbm9uZScsXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnJjpob3Zlcic6IHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IGNvbG9ycy5ncmF5c2NhbGUubGlnaHQ0LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgJz4gLmZhJzoge1xuICAgICAgICAgICAgY29sb3I6IGNvbG9ycy5ncmF5c2NhbGUubGlnaHQyLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgJyY6aG92ZXIgPiAuZmEnOiB7XG4gICAgICAgICAgICBjb2xvcjogY29sb3JzLmdyYXlzY2FsZS5saWdodDEsXG4gICAgICAgICAgfSxcbiAgICAgICAgfX1cbiAgICAgID5cbiAgICAgICAgPENvbHVtblR5cGVMYWJlbCB0eXBlPXtjb2x1bW4udHlwZX0gLz5cbiAgICAgICAge2NvbHVtbi5uYW1lfVxuICAgICAgICA8aVxuICAgICAgICAgIGNsYXNzTmFtZT1cImZhIGZhLWNhcmV0LXJpZ2h0XCJcbiAgICAgICAgICBjc3M9e3tcbiAgICAgICAgICAgIHBvc2l0aW9uOiAnYWJzb2x1dGUnLFxuICAgICAgICAgICAgcmlnaHQ6IDMgKiBncmlkVW5pdCxcbiAgICAgICAgICAgIHRvcDogMyAqIGdyaWRVbml0LFxuICAgICAgICAgIH19XG4gICAgICAgIC8+XG4gICAgICA8L2Rpdj5cbiAgICA8L1BvcG92ZXI+XG4gICk7XG59KTtcbiJdfQ== */") },



    ___EmotionJSX(ColumnTypeLabel, { type: column.type }),
    column.name,
    ___EmotionJSX("i", {
      className: "fa fa-caret-right",
      css: /*#__PURE__*/_css({
        position: 'absolute',
        right: 3 * gridUnit,
        top: 3 * gridUnit }, process.env.NODE_ENV === "production" ? "" : "/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9zaGFyZWQtY29udHJvbHMvY29tcG9uZW50cy9Db2x1bW5Db25maWdDb250cm9sL0NvbHVtbkNvbmZpZ0l0ZW0udHN4Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQXlFVSIsImZpbGUiOiIuLi8uLi8uLi8uLi9zcmMvc2hhcmVkLWNvbnRyb2xzL2NvbXBvbmVudHMvQ29sdW1uQ29uZmlnQ29udHJvbC9Db2x1bW5Db25maWdJdGVtLnRzeCIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogTGljZW5zZWQgdG8gdGhlIEFwYWNoZSBTb2Z0d2FyZSBGb3VuZGF0aW9uIChBU0YpIHVuZGVyIG9uZVxuICogb3IgbW9yZSBjb250cmlidXRvciBsaWNlbnNlIGFncmVlbWVudHMuICBTZWUgdGhlIE5PVElDRSBmaWxlXG4gKiBkaXN0cmlidXRlZCB3aXRoIHRoaXMgd29yayBmb3IgYWRkaXRpb25hbCBpbmZvcm1hdGlvblxuICogcmVnYXJkaW5nIGNvcHlyaWdodCBvd25lcnNoaXAuICBUaGUgQVNGIGxpY2Vuc2VzIHRoaXMgZmlsZVxuICogdG8geW91IHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZVxuICogXCJMaWNlbnNlXCIpOyB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlXG4gKiB3aXRoIHRoZSBMaWNlbnNlLiAgWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsXG4gKiBzb2Z0d2FyZSBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhblxuICogXCJBUyBJU1wiIEJBU0lTLCBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTllcbiAqIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuICBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZVxuICogc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZCBsaW1pdGF0aW9uc1xuICogdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cbmltcG9ydCBSZWFjdCBmcm9tICdyZWFjdCc7XG5pbXBvcnQgeyB1c2VUaGVtZSB9IGZyb20gJ0BzdXBlcnNldC11aS9jb3JlJztcbmltcG9ydCB7IFBvcG92ZXIgfSBmcm9tICdhbnRkJztcbmltcG9ydCBDb2x1bW5UeXBlTGFiZWwgZnJvbSAnLi4vLi4vLi4vY29tcG9uZW50cy9Db2x1bW5UeXBlTGFiZWwnO1xuaW1wb3J0IENvbHVtbkNvbmZpZ1BvcG92ZXIsIHtcbiAgQ29sdW1uQ29uZmlnUG9wb3ZlclByb3BzLFxufSBmcm9tICcuL0NvbHVtbkNvbmZpZ1BvcG92ZXInO1xuXG5leHBvcnQgdHlwZSBDb2x1bW5Db25maWdJdGVtUHJvcHMgPSBDb2x1bW5Db25maWdQb3BvdmVyUHJvcHM7XG5cbmV4cG9ydCBkZWZhdWx0IFJlYWN0Lm1lbW8oZnVuY3Rpb24gQ29sdW1uQ29uZmlnSXRlbSh7XG4gIGNvbHVtbixcbiAgb25DaGFuZ2UsXG4gIGNvbmZpZ0Zvcm1MYXlvdXQsXG59OiBDb2x1bW5Db25maWdJdGVtUHJvcHMpIHtcbiAgY29uc3QgeyBjb2xvcnMsIGdyaWRVbml0IH0gPSB1c2VUaGVtZSgpO1xuICBjb25zdCBjYXJldFdpZHRoID0gZ3JpZFVuaXQgKiA2O1xuICByZXR1cm4gKFxuICAgIDxQb3BvdmVyXG4gICAgICB0aXRsZT17Y29sdW1uLm5hbWV9XG4gICAgICBjb250ZW50PXsoKSA9PiAoXG4gICAgICAgIDxDb2x1bW5Db25maWdQb3BvdmVyXG4gICAgICAgICAgY29sdW1uPXtjb2x1bW59XG4gICAgICAgICAgb25DaGFuZ2U9e29uQ2hhbmdlfVxuICAgICAgICAgIGNvbmZpZ0Zvcm1MYXlvdXQ9e2NvbmZpZ0Zvcm1MYXlvdXR9XG4gICAgICAgIC8+XG4gICAgICApfVxuICAgICAgdHJpZ2dlcj1cImNsaWNrXCJcbiAgICAgIHBsYWNlbWVudD1cInJpZ2h0XCJcbiAgICA+XG4gICAgICA8ZGl2XG4gICAgICAgIGNzcz17e1xuICAgICAgICAgIGN1cnNvcjogJ3BvaW50ZXInLFxuICAgICAgICAgIHBhZGRpbmc6IGAkezEuNSAqIGdyaWRVbml0fXB4ICR7MiAqIGdyaWRVbml0fXB4YCxcbiAgICAgICAgICBib3JkZXJCb3R0b206IGAxcHggc29saWQgJHtjb2xvcnMuZ3JheXNjYWxlLmxpZ2h0Mn1gLFxuICAgICAgICAgIHBvc2l0aW9uOiAncmVsYXRpdmUnLFxuICAgICAgICAgIHBhZGRpbmdSaWdodDogY2FyZXRXaWR0aCxcbiAgICAgICAgICAnJjpsYXN0LWNoaWxkJzoge1xuICAgICAgICAgICAgYm9yZGVyQm90dG9tOiAnbm9uZScsXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnJjpob3Zlcic6IHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IGNvbG9ycy5ncmF5c2NhbGUubGlnaHQ0LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgJz4gLmZhJzoge1xuICAgICAgICAgICAgY29sb3I6IGNvbG9ycy5ncmF5c2NhbGUubGlnaHQyLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgJyY6aG92ZXIgPiAuZmEnOiB7XG4gICAgICAgICAgICBjb2xvcjogY29sb3JzLmdyYXlzY2FsZS5saWdodDEsXG4gICAgICAgICAgfSxcbiAgICAgICAgfX1cbiAgICAgID5cbiAgICAgICAgPENvbHVtblR5cGVMYWJlbCB0eXBlPXtjb2x1bW4udHlwZX0gLz5cbiAgICAgICAge2NvbHVtbi5uYW1lfVxuICAgICAgICA8aVxuICAgICAgICAgIGNsYXNzTmFtZT1cImZhIGZhLWNhcmV0LXJpZ2h0XCJcbiAgICAgICAgICBjc3M9e3tcbiAgICAgICAgICAgIHBvc2l0aW9uOiAnYWJzb2x1dGUnLFxuICAgICAgICAgICAgcmlnaHQ6IDMgKiBncmlkVW5pdCxcbiAgICAgICAgICAgIHRvcDogMyAqIGdyaWRVbml0LFxuICAgICAgICAgIH19XG4gICAgICAgIC8+XG4gICAgICA8L2Rpdj5cbiAgICA8L1BvcG92ZXI+XG4gICk7XG59KTtcbiJdfQ== */") }))));





}, "useTheme{{ colors, gridUnit }}", () => [useTheme]));export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/shared-controls/components/ColumnConfigControl/ColumnConfigItem.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();