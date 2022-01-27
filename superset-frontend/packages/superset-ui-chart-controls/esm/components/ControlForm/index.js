import { css as _css } from "@emotion/react";import _pt from "prop-types";import _debounce from "lodash/debounce";(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /**
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
import React, { useMemo } from 'react';
import {
FAST_DEBOUNCE,


useTheme } from
'@superset-ui/core';import { jsx as ___EmotionJSX } from "@emotion/react";



export * from './ControlFormItem';





export function ControlFormRow({ children }) {
  const { gridUnit } = useTheme();
  return (
    ___EmotionJSX("div", {
      css: /*#__PURE__*/_css({
        display: 'flex',
        flexWrap: 'nowrap',
        margin: -2 * gridUnit,
        marginBottom: gridUnit }, process.env.NODE_ENV === "production" ? "" : ";label:ControlFormRow;", process.env.NODE_ENV === "production" ? "" : "/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jb21wb25lbnRzL0NvbnRyb2xGb3JtL2luZGV4LnRzeCJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFzQ00iLCJmaWxlIjoiLi4vLi4vLi4vc3JjL2NvbXBvbmVudHMvQ29udHJvbEZvcm0vaW5kZXgudHN4Iiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBMaWNlbnNlZCB0byB0aGUgQXBhY2hlIFNvZnR3YXJlIEZvdW5kYXRpb24gKEFTRikgdW5kZXIgb25lXG4gKiBvciBtb3JlIGNvbnRyaWJ1dG9yIGxpY2Vuc2UgYWdyZWVtZW50cy4gIFNlZSB0aGUgTk9USUNFIGZpbGVcbiAqIGRpc3RyaWJ1dGVkIHdpdGggdGhpcyB3b3JrIGZvciBhZGRpdGlvbmFsIGluZm9ybWF0aW9uXG4gKiByZWdhcmRpbmcgY29weXJpZ2h0IG93bmVyc2hpcC4gIFRoZSBBU0YgbGljZW5zZXMgdGhpcyBmaWxlXG4gKiB0byB5b3UgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlXG4gKiBcIkxpY2Vuc2VcIik7IHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2VcbiAqIHdpdGggdGhlIExpY2Vuc2UuICBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZyxcbiAqIHNvZnR3YXJlIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuXG4gKiBcIkFTIElTXCIgQkFTSVMsIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWVxuICogS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC4gIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlXG4gKiBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kIGxpbWl0YXRpb25zXG4gKiB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuaW1wb3J0IFJlYWN0LCB7IEZ1bmN0aW9uQ29tcG9uZW50RWxlbWVudCwgdXNlTWVtbyB9IGZyb20gJ3JlYWN0JztcbmltcG9ydCB7XG4gIEZBU1RfREVCT1VOQ0UsXG4gIEpzb25PYmplY3QsXG4gIEpzb25WYWx1ZSxcbiAgdXNlVGhlbWUsXG59IGZyb20gJ0BzdXBlcnNldC11aS9jb3JlJztcbmltcG9ydCB7IGRlYm91bmNlIH0gZnJvbSAnbG9kYXNoJztcbmltcG9ydCB7IENvbnRyb2xGb3JtSXRlbU5vZGUgfSBmcm9tICcuL0NvbnRyb2xGb3JtSXRlbSc7XG5cbmV4cG9ydCAqIGZyb20gJy4vQ29udHJvbEZvcm1JdGVtJztcblxuZXhwb3J0IHR5cGUgQ29udHJvbEZvcm1Sb3dQcm9wcyA9IHtcbiAgY2hpbGRyZW46IENvbnRyb2xGb3JtSXRlbU5vZGUgfCBDb250cm9sRm9ybUl0ZW1Ob2RlW107XG59O1xuXG5leHBvcnQgZnVuY3Rpb24gQ29udHJvbEZvcm1Sb3coeyBjaGlsZHJlbiB9OiBDb250cm9sRm9ybVJvd1Byb3BzKSB7XG4gIGNvbnN0IHsgZ3JpZFVuaXQgfSA9IHVzZVRoZW1lKCk7XG4gIHJldHVybiAoXG4gICAgPGRpdlxuICAgICAgY3NzPXt7XG4gICAgICAgIGRpc3BsYXk6ICdmbGV4JyxcbiAgICAgICAgZmxleFdyYXA6ICdub3dyYXAnLFxuICAgICAgICBtYXJnaW46IC0yICogZ3JpZFVuaXQsXG4gICAgICAgIG1hcmdpbkJvdHRvbTogZ3JpZFVuaXQsXG4gICAgICB9fVxuICAgID5cbiAgICAgIHtjaGlsZHJlbn1cbiAgICA8L2Rpdj5cbiAgKTtcbn1cblxudHlwZSBDb250cm9sRm9ybVJvd05vZGUgPSBGdW5jdGlvbkNvbXBvbmVudEVsZW1lbnQ8Q29udHJvbEZvcm1Sb3dQcm9wcz47XG5cbmV4cG9ydCB0eXBlIENvbnRyb2xGb3JtUHJvcHMgPSB7XG4gIC8qKlxuICAgKiBGb3JtIGZpZWxkIHZhbHVlcyBkaWN0LlxuICAgKi9cbiAgdmFsdWU/OiBKc29uT2JqZWN0O1xuICBvbkNoYW5nZTogKHZhbHVlOiBKc29uT2JqZWN0KSA9PiB2b2lkO1xuICBjaGlsZHJlbjogQ29udHJvbEZvcm1Sb3dOb2RlIHwgQ29udHJvbEZvcm1Sb3dOb2RlW107XG59O1xuXG4vKipcbiAqIExpZ2h0IHdlaWdodCBmb3JtIGZvciBjb250cm9sIHBhbmVsLlxuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBDb250cm9sRm9ybSh7XG4gIG9uQ2hhbmdlLFxuICB2YWx1ZSxcbiAgY2hpbGRyZW4sXG59OiBDb250cm9sRm9ybVByb3BzKSB7XG4gIGNvbnN0IHRoZW1lID0gdXNlVGhlbWUoKTtcbiAgY29uc3QgZGVib3VuY2VkT25DaGFuZ2UgPSB1c2VNZW1vKFxuICAgICgpID0+XG4gICAgICAoe1xuICAgICAgICAwOiBvbkNoYW5nZSxcbiAgICAgICAgW0ZBU1RfREVCT1VOQ0VdOiBkZWJvdW5jZShvbkNoYW5nZSwgRkFTVF9ERUJPVU5DRSksXG4gICAgICB9IGFzIFJlY29yZDxudW1iZXIsIHR5cGVvZiBvbkNoYW5nZT4pLFxuICAgIFtvbkNoYW5nZV0sXG4gICk7XG5cbiAgY29uc3QgdXBkYXRlZENoaWxkcmVuID0gUmVhY3QuQ2hpbGRyZW4ubWFwKGNoaWxkcmVuLCByb3cgPT4ge1xuICAgIGlmICgnY2hpbGRyZW4nIGluIHJvdy5wcm9wcykge1xuICAgICAgY29uc3QgZGVmYXVsdFdpZHRoID0gQXJyYXkuaXNBcnJheShyb3cucHJvcHMuY2hpbGRyZW4pXG4gICAgICAgID8gYCR7MTAwIC8gcm93LnByb3BzLmNoaWxkcmVuLmxlbmd0aH0lYFxuICAgICAgICA6IHVuZGVmaW5lZDtcbiAgICAgIHJldHVybiBSZWFjdC5jbG9uZUVsZW1lbnQocm93LCB7XG4gICAgICAgIGNoaWxkcmVuOiBSZWFjdC5DaGlsZHJlbi5tYXAocm93LnByb3BzLmNoaWxkcmVuLCBpdGVtID0+IHtcbiAgICAgICAgICBjb25zdCB7XG4gICAgICAgICAgICBuYW1lLFxuICAgICAgICAgICAgd2lkdGgsXG4gICAgICAgICAgICBkZWJvdW5jZURlbGF5ID0gRkFTVF9ERUJPVU5DRSxcbiAgICAgICAgICAgIG9uQ2hhbmdlOiBvbkl0ZW1WYWx1ZUNoYW5nZSxcbiAgICAgICAgICB9ID0gaXRlbS5wcm9wcztcbiAgICAgICAgICByZXR1cm4gUmVhY3QuY2xvbmVFbGVtZW50KGl0ZW0sIHtcbiAgICAgICAgICAgIHdpZHRoOiB3aWR0aCB8fCBkZWZhdWx0V2lkdGgsXG4gICAgICAgICAgICB2YWx1ZTogdmFsdWU/LltuYW1lXSxcbiAgICAgICAgICAgIC8vIHJlbW92ZSBgZGVib3VuY2VEZWxheWAgZnJvbSByZW5kZXJlZCBjb250cm9sIGl0ZW0gcHJvcHNcbiAgICAgICAgICAgIC8vIHNvIFJlYWN0IERldlRvb2xzIGRvbid0IHRocm93IGEgYGludmFsaWQgcHJvcGAgd2FybmluZy5cbiAgICAgICAgICAgIGRlYm91bmNlRGVsYXk6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIG9uQ2hhbmdlKGZpZWxkVmFsdWU6IEpzb25WYWx1ZSkge1xuICAgICAgICAgICAgICAvLyBjYWxsIGBvbkNoYW5nZWAgb24gZWFjaCBGb3JtSXRlbVxuICAgICAgICAgICAgICBpZiAob25JdGVtVmFsdWVDaGFuZ2UpIHtcbiAgICAgICAgICAgICAgICBvbkl0ZW1WYWx1ZUNoYW5nZShmaWVsZFZhbHVlKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAvLyBwcm9wYWdhdGUgdG8gdGhlIGZvcm1cbiAgICAgICAgICAgICAgaWYgKCEoZGVib3VuY2VEZWxheSBpbiBkZWJvdW5jZWRPbkNoYW5nZSkpIHtcbiAgICAgICAgICAgICAgICBkZWJvdW5jZWRPbkNoYW5nZVtkZWJvdW5jZURlbGF5XSA9IGRlYm91bmNlKFxuICAgICAgICAgICAgICAgICAgb25DaGFuZ2UsXG4gICAgICAgICAgICAgICAgICBkZWJvdW5jZURlbGF5LFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZGVib3VuY2VkT25DaGFuZ2VbZGVib3VuY2VEZWxheV0oe1xuICAgICAgICAgICAgICAgIC4uLnZhbHVlLFxuICAgICAgICAgICAgICAgIFtuYW1lXTogZmllbGRWYWx1ZSxcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pO1xuICAgICAgICB9KSxcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gcm93O1xuICB9KTtcbiAgcmV0dXJuIChcbiAgICA8ZGl2XG4gICAgICBjc3M9e3tcbiAgICAgICAgbGFiZWw6IHtcbiAgICAgICAgICB0ZXh0VHJhbnNmb3JtOiAndXBwZXJjYXNlJyxcbiAgICAgICAgICBjb2xvcjogdGhlbWUuY29sb3JzLnRleHQubGFiZWwsXG4gICAgICAgICAgZm9udFNpemU6IHRoZW1lLnR5cG9ncmFwaHkuc2l6ZXMucyxcbiAgICAgICAgfSxcbiAgICAgIH19XG4gICAgPlxuICAgICAge3VwZGF0ZWRDaGlsZHJlbn1cbiAgICA8L2Rpdj5cbiAgKTtcbn1cbiJdfQ== */") },


    children));


}__signature__(ControlFormRow, "useTheme{{ gridUnit }}", () => [useTheme]);












/**
 * Light weight form for control panel.
 */
export default function ControlForm({
  onChange,
  value,
  children })
{
  const theme = useTheme();
  const debouncedOnChange = useMemo(
  () => (
  {
    0: onChange,
    [FAST_DEBOUNCE]: _debounce(onChange, FAST_DEBOUNCE) }),

  [onChange]);


  const updatedChildren = React.Children.map(children, (row) => {
    if ('children' in row.props) {
      const defaultWidth = Array.isArray(row.props.children) ?
      `${100 / row.props.children.length}%` :
      undefined;
      return /*#__PURE__*/React.cloneElement(row, {
        children: React.Children.map(row.props.children, (item) => {
          const {
            name,
            width,
            debounceDelay = FAST_DEBOUNCE,
            onChange: onItemValueChange } =
          item.props;
          return /*#__PURE__*/React.cloneElement(item, {
            width: width || defaultWidth,
            value: value == null ? void 0 : value[name],
            // remove `debounceDelay` from rendered control item props
            // so React DevTools don't throw a `invalid prop` warning.
            debounceDelay: undefined,
            onChange(fieldValue) {
              // call `onChange` on each FormItem
              if (onItemValueChange) {
                onItemValueChange(fieldValue);
              }
              // propagate to the form
              if (!(debounceDelay in debouncedOnChange)) {
                debouncedOnChange[debounceDelay] = _debounce(
                onChange,
                debounceDelay);

              }
              debouncedOnChange[debounceDelay]({
                ...value,
                [name]: fieldValue });

            } });

        }) });

    }
    return row;
  });
  return (
    ___EmotionJSX("div", {
      css: /*#__PURE__*/_css({
        label: {
          textTransform: 'uppercase',
          color: theme.colors.text.label,
          fontSize: theme.typography.sizes.s } }, process.env.NODE_ENV === "production" ? "" : ";label:ControlForm;", process.env.NODE_ENV === "production" ? "" : "/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jb21wb25lbnRzL0NvbnRyb2xGb3JtL2luZGV4LnRzeCJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUEySE0iLCJmaWxlIjoiLi4vLi4vLi4vc3JjL2NvbXBvbmVudHMvQ29udHJvbEZvcm0vaW5kZXgudHN4Iiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBMaWNlbnNlZCB0byB0aGUgQXBhY2hlIFNvZnR3YXJlIEZvdW5kYXRpb24gKEFTRikgdW5kZXIgb25lXG4gKiBvciBtb3JlIGNvbnRyaWJ1dG9yIGxpY2Vuc2UgYWdyZWVtZW50cy4gIFNlZSB0aGUgTk9USUNFIGZpbGVcbiAqIGRpc3RyaWJ1dGVkIHdpdGggdGhpcyB3b3JrIGZvciBhZGRpdGlvbmFsIGluZm9ybWF0aW9uXG4gKiByZWdhcmRpbmcgY29weXJpZ2h0IG93bmVyc2hpcC4gIFRoZSBBU0YgbGljZW5zZXMgdGhpcyBmaWxlXG4gKiB0byB5b3UgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlXG4gKiBcIkxpY2Vuc2VcIik7IHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2VcbiAqIHdpdGggdGhlIExpY2Vuc2UuICBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZyxcbiAqIHNvZnR3YXJlIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuXG4gKiBcIkFTIElTXCIgQkFTSVMsIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWVxuICogS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC4gIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlXG4gKiBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kIGxpbWl0YXRpb25zXG4gKiB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuaW1wb3J0IFJlYWN0LCB7IEZ1bmN0aW9uQ29tcG9uZW50RWxlbWVudCwgdXNlTWVtbyB9IGZyb20gJ3JlYWN0JztcbmltcG9ydCB7XG4gIEZBU1RfREVCT1VOQ0UsXG4gIEpzb25PYmplY3QsXG4gIEpzb25WYWx1ZSxcbiAgdXNlVGhlbWUsXG59IGZyb20gJ0BzdXBlcnNldC11aS9jb3JlJztcbmltcG9ydCB7IGRlYm91bmNlIH0gZnJvbSAnbG9kYXNoJztcbmltcG9ydCB7IENvbnRyb2xGb3JtSXRlbU5vZGUgfSBmcm9tICcuL0NvbnRyb2xGb3JtSXRlbSc7XG5cbmV4cG9ydCAqIGZyb20gJy4vQ29udHJvbEZvcm1JdGVtJztcblxuZXhwb3J0IHR5cGUgQ29udHJvbEZvcm1Sb3dQcm9wcyA9IHtcbiAgY2hpbGRyZW46IENvbnRyb2xGb3JtSXRlbU5vZGUgfCBDb250cm9sRm9ybUl0ZW1Ob2RlW107XG59O1xuXG5leHBvcnQgZnVuY3Rpb24gQ29udHJvbEZvcm1Sb3coeyBjaGlsZHJlbiB9OiBDb250cm9sRm9ybVJvd1Byb3BzKSB7XG4gIGNvbnN0IHsgZ3JpZFVuaXQgfSA9IHVzZVRoZW1lKCk7XG4gIHJldHVybiAoXG4gICAgPGRpdlxuICAgICAgY3NzPXt7XG4gICAgICAgIGRpc3BsYXk6ICdmbGV4JyxcbiAgICAgICAgZmxleFdyYXA6ICdub3dyYXAnLFxuICAgICAgICBtYXJnaW46IC0yICogZ3JpZFVuaXQsXG4gICAgICAgIG1hcmdpbkJvdHRvbTogZ3JpZFVuaXQsXG4gICAgICB9fVxuICAgID5cbiAgICAgIHtjaGlsZHJlbn1cbiAgICA8L2Rpdj5cbiAgKTtcbn1cblxudHlwZSBDb250cm9sRm9ybVJvd05vZGUgPSBGdW5jdGlvbkNvbXBvbmVudEVsZW1lbnQ8Q29udHJvbEZvcm1Sb3dQcm9wcz47XG5cbmV4cG9ydCB0eXBlIENvbnRyb2xGb3JtUHJvcHMgPSB7XG4gIC8qKlxuICAgKiBGb3JtIGZpZWxkIHZhbHVlcyBkaWN0LlxuICAgKi9cbiAgdmFsdWU/OiBKc29uT2JqZWN0O1xuICBvbkNoYW5nZTogKHZhbHVlOiBKc29uT2JqZWN0KSA9PiB2b2lkO1xuICBjaGlsZHJlbjogQ29udHJvbEZvcm1Sb3dOb2RlIHwgQ29udHJvbEZvcm1Sb3dOb2RlW107XG59O1xuXG4vKipcbiAqIExpZ2h0IHdlaWdodCBmb3JtIGZvciBjb250cm9sIHBhbmVsLlxuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBDb250cm9sRm9ybSh7XG4gIG9uQ2hhbmdlLFxuICB2YWx1ZSxcbiAgY2hpbGRyZW4sXG59OiBDb250cm9sRm9ybVByb3BzKSB7XG4gIGNvbnN0IHRoZW1lID0gdXNlVGhlbWUoKTtcbiAgY29uc3QgZGVib3VuY2VkT25DaGFuZ2UgPSB1c2VNZW1vKFxuICAgICgpID0+XG4gICAgICAoe1xuICAgICAgICAwOiBvbkNoYW5nZSxcbiAgICAgICAgW0ZBU1RfREVCT1VOQ0VdOiBkZWJvdW5jZShvbkNoYW5nZSwgRkFTVF9ERUJPVU5DRSksXG4gICAgICB9IGFzIFJlY29yZDxudW1iZXIsIHR5cGVvZiBvbkNoYW5nZT4pLFxuICAgIFtvbkNoYW5nZV0sXG4gICk7XG5cbiAgY29uc3QgdXBkYXRlZENoaWxkcmVuID0gUmVhY3QuQ2hpbGRyZW4ubWFwKGNoaWxkcmVuLCByb3cgPT4ge1xuICAgIGlmICgnY2hpbGRyZW4nIGluIHJvdy5wcm9wcykge1xuICAgICAgY29uc3QgZGVmYXVsdFdpZHRoID0gQXJyYXkuaXNBcnJheShyb3cucHJvcHMuY2hpbGRyZW4pXG4gICAgICAgID8gYCR7MTAwIC8gcm93LnByb3BzLmNoaWxkcmVuLmxlbmd0aH0lYFxuICAgICAgICA6IHVuZGVmaW5lZDtcbiAgICAgIHJldHVybiBSZWFjdC5jbG9uZUVsZW1lbnQocm93LCB7XG4gICAgICAgIGNoaWxkcmVuOiBSZWFjdC5DaGlsZHJlbi5tYXAocm93LnByb3BzLmNoaWxkcmVuLCBpdGVtID0+IHtcbiAgICAgICAgICBjb25zdCB7XG4gICAgICAgICAgICBuYW1lLFxuICAgICAgICAgICAgd2lkdGgsXG4gICAgICAgICAgICBkZWJvdW5jZURlbGF5ID0gRkFTVF9ERUJPVU5DRSxcbiAgICAgICAgICAgIG9uQ2hhbmdlOiBvbkl0ZW1WYWx1ZUNoYW5nZSxcbiAgICAgICAgICB9ID0gaXRlbS5wcm9wcztcbiAgICAgICAgICByZXR1cm4gUmVhY3QuY2xvbmVFbGVtZW50KGl0ZW0sIHtcbiAgICAgICAgICAgIHdpZHRoOiB3aWR0aCB8fCBkZWZhdWx0V2lkdGgsXG4gICAgICAgICAgICB2YWx1ZTogdmFsdWU/LltuYW1lXSxcbiAgICAgICAgICAgIC8vIHJlbW92ZSBgZGVib3VuY2VEZWxheWAgZnJvbSByZW5kZXJlZCBjb250cm9sIGl0ZW0gcHJvcHNcbiAgICAgICAgICAgIC8vIHNvIFJlYWN0IERldlRvb2xzIGRvbid0IHRocm93IGEgYGludmFsaWQgcHJvcGAgd2FybmluZy5cbiAgICAgICAgICAgIGRlYm91bmNlRGVsYXk6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIG9uQ2hhbmdlKGZpZWxkVmFsdWU6IEpzb25WYWx1ZSkge1xuICAgICAgICAgICAgICAvLyBjYWxsIGBvbkNoYW5nZWAgb24gZWFjaCBGb3JtSXRlbVxuICAgICAgICAgICAgICBpZiAob25JdGVtVmFsdWVDaGFuZ2UpIHtcbiAgICAgICAgICAgICAgICBvbkl0ZW1WYWx1ZUNoYW5nZShmaWVsZFZhbHVlKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAvLyBwcm9wYWdhdGUgdG8gdGhlIGZvcm1cbiAgICAgICAgICAgICAgaWYgKCEoZGVib3VuY2VEZWxheSBpbiBkZWJvdW5jZWRPbkNoYW5nZSkpIHtcbiAgICAgICAgICAgICAgICBkZWJvdW5jZWRPbkNoYW5nZVtkZWJvdW5jZURlbGF5XSA9IGRlYm91bmNlKFxuICAgICAgICAgICAgICAgICAgb25DaGFuZ2UsXG4gICAgICAgICAgICAgICAgICBkZWJvdW5jZURlbGF5LFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZGVib3VuY2VkT25DaGFuZ2VbZGVib3VuY2VEZWxheV0oe1xuICAgICAgICAgICAgICAgIC4uLnZhbHVlLFxuICAgICAgICAgICAgICAgIFtuYW1lXTogZmllbGRWYWx1ZSxcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pO1xuICAgICAgICB9KSxcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gcm93O1xuICB9KTtcbiAgcmV0dXJuIChcbiAgICA8ZGl2XG4gICAgICBjc3M9e3tcbiAgICAgICAgbGFiZWw6IHtcbiAgICAgICAgICB0ZXh0VHJhbnNmb3JtOiAndXBwZXJjYXNlJyxcbiAgICAgICAgICBjb2xvcjogdGhlbWUuY29sb3JzLnRleHQubGFiZWwsXG4gICAgICAgICAgZm9udFNpemU6IHRoZW1lLnR5cG9ncmFwaHkuc2l6ZXMucyxcbiAgICAgICAgfSxcbiAgICAgIH19XG4gICAgPlxuICAgICAge3VwZGF0ZWRDaGlsZHJlbn1cbiAgICA8L2Rpdj5cbiAgKTtcbn1cbiJdfQ== */") },



    updatedChildren));


}__signature__(ControlForm, "useTheme{theme}\nuseMemo{debouncedOnChange}", () => [useTheme]);ControlForm.propTypes = { onChange: _pt.func.isRequired, children: _pt.oneOfType([_pt.element, _pt.arrayOf(_pt.element)]).isRequired };;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(ControlFormRow, "ControlFormRow", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/components/ControlForm/index.tsx");reactHotLoader.register(ControlForm, "ControlForm", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/components/ControlForm/index.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();