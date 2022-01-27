import _extends from "@babel/runtime-corejs3/helpers/extends";import { css as _css } from "@emotion/react";import _pt from "prop-types";(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /**
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
import React, { useState } from 'react';
import { useTheme } from '@superset-ui/core';
import ControlHeader from '../ControlHeader';
import InfoTooltipWithTrigger from '../InfoTooltipWithTrigger';
import { ControlFormItemComponents } from './controls';import { jsx as ___EmotionJSX } from "@emotion/react";

export * from './controls';









/**
 * Accept `false` or `0`, but not empty string.
 */
function isEmptyValue(value) {
  return value == null || value === '';
}

export function ControlFormItem({
  name,
  label,
  description,
  width,
  validators,
  required,
  onChange,
  value: initialValue,
  defaultValue,
  controlType,
  ...props })
{
  const { gridUnit } = useTheme();
  const [hovered, setHovered] = useState(false);
  const [value, setValue] = useState(
  initialValue === undefined ? defaultValue : initialValue);

  const [validationErrors, setValidationErrors] =
  useState();

  const handleChange = (e) => {
    const fieldValue =
    e && typeof e === 'object' && 'target' in e ?
    e.target.type === 'checkbox' || e.target.type === 'radio' ?
    e.target.checked :
    e.target.value :
    e;
    const errors =
    (validators == null ? void 0 : validators.
    map((validator) =>
    !required && isEmptyValue(fieldValue) ? false : validator(fieldValue)).

    filter((x) => !!x)) || [];
    setValidationErrors(errors);
    setValue(fieldValue);
    if (errors.length === 0 && onChange) {
      onChange(fieldValue);
    }
  };

  const Control = ControlFormItemComponents[controlType];

  return (
    ___EmotionJSX("div", {
      css: /*#__PURE__*/_css({
        margin: 2 * gridUnit,
        width }, process.env.NODE_ENV === "production" ? "" : ";label:ControlFormItem;", process.env.NODE_ENV === "production" ? "" : "/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jb21wb25lbnRzL0NvbnRyb2xGb3JtL0NvbnRyb2xGb3JtSXRlbS50c3giXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBc0ZNIiwiZmlsZSI6Ii4uLy4uLy4uL3NyYy9jb21wb25lbnRzL0NvbnRyb2xGb3JtL0NvbnRyb2xGb3JtSXRlbS50c3giLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIExpY2Vuc2VkIHRvIHRoZSBBcGFjaGUgU29mdHdhcmUgRm91bmRhdGlvbiAoQVNGKSB1bmRlciBvbmVcbiAqIG9yIG1vcmUgY29udHJpYnV0b3IgbGljZW5zZSBhZ3JlZW1lbnRzLiAgU2VlIHRoZSBOT1RJQ0UgZmlsZVxuICogZGlzdHJpYnV0ZWQgd2l0aCB0aGlzIHdvcmsgZm9yIGFkZGl0aW9uYWwgaW5mb3JtYXRpb25cbiAqIHJlZ2FyZGluZyBjb3B5cmlnaHQgb3duZXJzaGlwLiAgVGhlIEFTRiBsaWNlbnNlcyB0aGlzIGZpbGVcbiAqIHRvIHlvdSB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGVcbiAqIFwiTGljZW5zZVwiKTsgeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZVxuICogd2l0aCB0aGUgTGljZW5zZS4gIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLFxuICogc29mdHdhcmUgZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW5cbiAqIFwiQVMgSVNcIiBCQVNJUywgV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZXG4gKiBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLiAgU2VlIHRoZSBMaWNlbnNlIGZvciB0aGVcbiAqIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmQgbGltaXRhdGlvbnNcbiAqIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG5pbXBvcnQgUmVhY3QsIHsgdXNlU3RhdGUsIEZ1bmN0aW9uQ29tcG9uZW50RWxlbWVudCwgQ2hhbmdlRXZlbnQgfSBmcm9tICdyZWFjdCc7XG5pbXBvcnQgeyBKc29uVmFsdWUsIHVzZVRoZW1lIH0gZnJvbSAnQHN1cGVyc2V0LXVpL2NvcmUnO1xuaW1wb3J0IENvbnRyb2xIZWFkZXIsIHsgQ29udHJvbEhlYWRlclByb3BzIH0gZnJvbSAnLi4vQ29udHJvbEhlYWRlcic7XG5pbXBvcnQgSW5mb1Rvb2x0aXBXaXRoVHJpZ2dlciBmcm9tICcuLi9JbmZvVG9vbHRpcFdpdGhUcmlnZ2VyJztcbmltcG9ydCB7IENvbnRyb2xGb3JtSXRlbUNvbXBvbmVudHMsIENvbnRyb2xGb3JtSXRlbVNwZWMgfSBmcm9tICcuL2NvbnRyb2xzJztcblxuZXhwb3J0ICogZnJvbSAnLi9jb250cm9scyc7XG5cbmV4cG9ydCB0eXBlIENvbnRyb2xGb3JtSXRlbVByb3BzID0gQ29udHJvbEZvcm1JdGVtU3BlYyAmIHtcbiAgbmFtZTogc3RyaW5nO1xuICBvbkNoYW5nZT86IChmaWVsZFZhbHVlOiBKc29uVmFsdWUpID0+IHZvaWQ7XG59O1xuXG5leHBvcnQgdHlwZSBDb250cm9sRm9ybUl0ZW1Ob2RlID1cbiAgRnVuY3Rpb25Db21wb25lbnRFbGVtZW50PENvbnRyb2xGb3JtSXRlbVByb3BzPjtcblxuLyoqXG4gKiBBY2NlcHQgYGZhbHNlYCBvciBgMGAsIGJ1dCBub3QgZW1wdHkgc3RyaW5nLlxuICovXG5mdW5jdGlvbiBpc0VtcHR5VmFsdWUodmFsdWU/OiBKc29uVmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlID09IG51bGwgfHwgdmFsdWUgPT09ICcnO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gQ29udHJvbEZvcm1JdGVtKHtcbiAgbmFtZSxcbiAgbGFiZWwsXG4gIGRlc2NyaXB0aW9uLFxuICB3aWR0aCxcbiAgdmFsaWRhdG9ycyxcbiAgcmVxdWlyZWQsXG4gIG9uQ2hhbmdlLFxuICB2YWx1ZTogaW5pdGlhbFZhbHVlLFxuICBkZWZhdWx0VmFsdWUsXG4gIGNvbnRyb2xUeXBlLFxuICAuLi5wcm9wc1xufTogQ29udHJvbEZvcm1JdGVtUHJvcHMpIHtcbiAgY29uc3QgeyBncmlkVW5pdCB9ID0gdXNlVGhlbWUoKTtcbiAgY29uc3QgW2hvdmVyZWQsIHNldEhvdmVyZWRdID0gdXNlU3RhdGUoZmFsc2UpO1xuICBjb25zdCBbdmFsdWUsIHNldFZhbHVlXSA9IHVzZVN0YXRlKFxuICAgIGluaXRpYWxWYWx1ZSA9PT0gdW5kZWZpbmVkID8gZGVmYXVsdFZhbHVlIDogaW5pdGlhbFZhbHVlLFxuICApO1xuICBjb25zdCBbdmFsaWRhdGlvbkVycm9ycywgc2V0VmFsaWRhdGlvbkVycm9yc10gPVxuICAgIHVzZVN0YXRlPENvbnRyb2xIZWFkZXJQcm9wc1sndmFsaWRhdGlvbkVycm9ycyddPigpO1xuXG4gIGNvbnN0IGhhbmRsZUNoYW5nZSA9IChlOiBDaGFuZ2VFdmVudDxIVE1MSW5wdXRFbGVtZW50PiB8IEpzb25WYWx1ZSkgPT4ge1xuICAgIGNvbnN0IGZpZWxkVmFsdWUgPVxuICAgICAgZSAmJiB0eXBlb2YgZSA9PT0gJ29iamVjdCcgJiYgJ3RhcmdldCcgaW4gZVxuICAgICAgICA/IGUudGFyZ2V0LnR5cGUgPT09ICdjaGVja2JveCcgfHwgZS50YXJnZXQudHlwZSA9PT0gJ3JhZGlvJ1xuICAgICAgICAgID8gZS50YXJnZXQuY2hlY2tlZFxuICAgICAgICAgIDogZS50YXJnZXQudmFsdWVcbiAgICAgICAgOiBlO1xuICAgIGNvbnN0IGVycm9ycyA9XG4gICAgICAodmFsaWRhdG9yc1xuICAgICAgICA/Lm1hcCh2YWxpZGF0b3IgPT5cbiAgICAgICAgICAhcmVxdWlyZWQgJiYgaXNFbXB0eVZhbHVlKGZpZWxkVmFsdWUpID8gZmFsc2UgOiB2YWxpZGF0b3IoZmllbGRWYWx1ZSksXG4gICAgICAgIClcbiAgICAgICAgLmZpbHRlcih4ID0+ICEheCkgYXMgc3RyaW5nW10pIHx8IFtdO1xuICAgIHNldFZhbGlkYXRpb25FcnJvcnMoZXJyb3JzKTtcbiAgICBzZXRWYWx1ZShmaWVsZFZhbHVlKTtcbiAgICBpZiAoZXJyb3JzLmxlbmd0aCA9PT0gMCAmJiBvbkNoYW5nZSkge1xuICAgICAgb25DaGFuZ2UoZmllbGRWYWx1ZSBhcyBKc29uVmFsdWUpO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBDb250cm9sID0gQ29udHJvbEZvcm1JdGVtQ29tcG9uZW50c1tjb250cm9sVHlwZV07XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2XG4gICAgICBjc3M9e3tcbiAgICAgICAgbWFyZ2luOiAyICogZ3JpZFVuaXQsXG4gICAgICAgIHdpZHRoLFxuICAgICAgfX1cbiAgICAgIG9uTW91c2VFbnRlcj17KCkgPT4gc2V0SG92ZXJlZCh0cnVlKX1cbiAgICAgIG9uTW91c2VMZWF2ZT17KCkgPT4gc2V0SG92ZXJlZChmYWxzZSl9XG4gICAgPlxuICAgICAge2NvbnRyb2xUeXBlID09PSAnQ2hlY2tib3gnID8gKFxuICAgICAgICA8Q29udHJvbEZvcm1JdGVtQ29tcG9uZW50cy5DaGVja2JveFxuICAgICAgICAgIGNoZWNrZWQ9e3ZhbHVlIGFzIGJvb2xlYW59XG4gICAgICAgICAgb25DaGFuZ2U9e2hhbmRsZUNoYW5nZX1cbiAgICAgICAgPlxuICAgICAgICAgIHtsYWJlbH17JyAnfVxuICAgICAgICAgIHtob3ZlcmVkICYmIGRlc2NyaXB0aW9uICYmIChcbiAgICAgICAgICAgIDxJbmZvVG9vbHRpcFdpdGhUcmlnZ2VyIHRvb2x0aXA9e2Rlc2NyaXB0aW9ufSAvPlxuICAgICAgICAgICl9XG4gICAgICAgIDwvQ29udHJvbEZvcm1JdGVtQ29tcG9uZW50cy5DaGVja2JveD5cbiAgICAgICkgOiAoXG4gICAgICAgIDw+XG4gICAgICAgICAge2xhYmVsICYmIChcbiAgICAgICAgICAgIDxDb250cm9sSGVhZGVyXG4gICAgICAgICAgICAgIG5hbWU9e25hbWV9XG4gICAgICAgICAgICAgIGxhYmVsPXtsYWJlbH1cbiAgICAgICAgICAgICAgZGVzY3JpcHRpb249e2Rlc2NyaXB0aW9ufVxuICAgICAgICAgICAgICB2YWxpZGF0aW9uRXJyb3JzPXt2YWxpZGF0aW9uRXJyb3JzfVxuICAgICAgICAgICAgICBob3ZlcmVkPXtob3ZlcmVkfVxuICAgICAgICAgICAgICByZXF1aXJlZD17cmVxdWlyZWR9XG4gICAgICAgICAgICAvPlxuICAgICAgICAgICl9XG4gICAgICAgICAgey8qIEB0cy1pZ25vcmUgKi99XG4gICAgICAgICAgPENvbnRyb2wgey4uLnByb3BzfSB2YWx1ZT17dmFsdWV9IG9uQ2hhbmdlPXtoYW5kbGVDaGFuZ2V9IC8+XG4gICAgICAgIDwvPlxuICAgICAgKX1cbiAgICA8L2Rpdj5cbiAgKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgQ29udHJvbEZvcm1JdGVtO1xuIl19 */"),

      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false) },

    controlType === 'Checkbox' ?
    ___EmotionJSX(ControlFormItemComponents.Checkbox, {
      checked: value,
      onChange: handleChange },

    label, ' ',
    hovered && description &&
    ___EmotionJSX(InfoTooltipWithTrigger, { tooltip: description })) :



    ___EmotionJSX(React.Fragment, null,
    label &&
    ___EmotionJSX(ControlHeader, {
      name: name,
      label: label,
      description: description,
      validationErrors: validationErrors,
      hovered: hovered,
      required: required }),



    ___EmotionJSX(Control, _extends({}, props, { value: value, onChange: handleChange })))));




}__signature__(ControlFormItem, "useTheme{{ gridUnit }}\nuseState{[hovered, setHovered](false)}\nuseState{[value, setValue](initialValue === undefined ? defaultValue : initialValue)}\nuseState{[validationErrors, setValidationErrors]}", () => [useTheme]);ControlFormItem.propTypes = { name: _pt.string.isRequired, onChange: _pt.func };const _default =

ControlFormItem;export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(isEmptyValue, "isEmptyValue", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/components/ControlForm/ControlFormItem.tsx");reactHotLoader.register(ControlFormItem, "ControlFormItem", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/components/ControlForm/ControlFormItem.tsx");reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/components/ControlForm/ControlFormItem.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();