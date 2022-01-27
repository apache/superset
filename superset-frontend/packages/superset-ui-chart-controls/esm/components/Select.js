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
import AntdSelect from 'antd/lib/select';import { jsx as ___EmotionJSX } from "@emotion/react";

export const { Option } = AntdSelect;









/**
 * AntD select with creatable options.
 */
export default function Select({
  creatable,
  onSearch,
  dropdownMatchSelectWidth = false,
  minWidth = '100%',
  showSearch: showSearch_ = true,
  onChange,
  options,
  children,
  value,
  ...props })
{
  const [searchValue, setSearchValue] = useState();
  // force show search if creatable
  const showSearch = showSearch_ || creatable;
  const handleSearch = showSearch ?
  (input) => {
    if (creatable) {
      setSearchValue(input);
    }
    if (onSearch) {
      onSearch(input);
    }
  } :
  undefined;

  const optionsHasSearchValue = options == null ? void 0 : options.some(([val]) => val === searchValue);
  const optionsHasValue = options == null ? void 0 : options.some(([val]) => val === value);

  const handleChange = showSearch ?
  (val, opt) => {
    // reset input value once selected
    setSearchValue('');
    if (onChange) {
      onChange(val, opt);
    }
  } :
  onChange;

  return (
    ___EmotionJSX(AntdSelect, _extends({
      dropdownMatchSelectWidth: dropdownMatchSelectWidth,
      showSearch: showSearch,
      onSearch: handleSearch,
      onChange: handleChange,
      value: value },
    props, {
      css: /*#__PURE__*/_css({
        minWidth }, process.env.NODE_ENV === "production" ? "" : ";label:Select;", process.env.NODE_ENV === "production" ? "" : "/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb21wb25lbnRzL1NlbGVjdC50c3giXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBaUZNIiwiZmlsZSI6Ii4uLy4uL3NyYy9jb21wb25lbnRzL1NlbGVjdC50c3giLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIExpY2Vuc2VkIHRvIHRoZSBBcGFjaGUgU29mdHdhcmUgRm91bmRhdGlvbiAoQVNGKSB1bmRlciBvbmVcbiAqIG9yIG1vcmUgY29udHJpYnV0b3IgbGljZW5zZSBhZ3JlZW1lbnRzLiAgU2VlIHRoZSBOT1RJQ0UgZmlsZVxuICogZGlzdHJpYnV0ZWQgd2l0aCB0aGlzIHdvcmsgZm9yIGFkZGl0aW9uYWwgaW5mb3JtYXRpb25cbiAqIHJlZ2FyZGluZyBjb3B5cmlnaHQgb3duZXJzaGlwLiAgVGhlIEFTRiBsaWNlbnNlcyB0aGlzIGZpbGVcbiAqIHRvIHlvdSB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGVcbiAqIFwiTGljZW5zZVwiKTsgeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZVxuICogd2l0aCB0aGUgTGljZW5zZS4gIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLFxuICogc29mdHdhcmUgZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW5cbiAqIFwiQVMgSVNcIiBCQVNJUywgV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZXG4gKiBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLiAgU2VlIHRoZSBMaWNlbnNlIGZvciB0aGVcbiAqIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmQgbGltaXRhdGlvbnNcbiAqIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG5pbXBvcnQgUmVhY3QsIHsgdXNlU3RhdGUsIFJlYWN0Tm9kZSB9IGZyb20gJ3JlYWN0JztcbmltcG9ydCBBbnRkU2VsZWN0LCB7IFNlbGVjdFByb3BzIGFzIEFudGRTZWxlY3RQcm9wcyB9IGZyb20gJ2FudGQvbGliL3NlbGVjdCc7XG5cbmV4cG9ydCBjb25zdCB7IE9wdGlvbiB9OiBhbnkgPSBBbnRkU2VsZWN0O1xuXG5leHBvcnQgdHlwZSBTZWxlY3RPcHRpb248VlQgPSBzdHJpbmc+ID0gW1ZULCBSZWFjdE5vZGVdO1xuXG5leHBvcnQgdHlwZSBTZWxlY3RQcm9wczxWVD4gPSBPbWl0PEFudGRTZWxlY3RQcm9wczxWVD4sICdvcHRpb25zJz4gJiB7XG4gIGNyZWF0YWJsZT86IGJvb2xlYW47XG4gIG1pbldpZHRoPzogc3RyaW5nIHwgbnVtYmVyO1xuICBvcHRpb25zPzogU2VsZWN0T3B0aW9uPFZUPltdO1xufTtcblxuLyoqXG4gKiBBbnREIHNlbGVjdCB3aXRoIGNyZWF0YWJsZSBvcHRpb25zLlxuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBTZWxlY3Q8VlQgZXh0ZW5kcyBzdHJpbmcgfCBudW1iZXI+KHtcbiAgY3JlYXRhYmxlLFxuICBvblNlYXJjaCxcbiAgZHJvcGRvd25NYXRjaFNlbGVjdFdpZHRoID0gZmFsc2UsXG4gIG1pbldpZHRoID0gJzEwMCUnLFxuICBzaG93U2VhcmNoOiBzaG93U2VhcmNoXyA9IHRydWUsXG4gIG9uQ2hhbmdlLFxuICBvcHRpb25zLFxuICBjaGlsZHJlbixcbiAgdmFsdWUsXG4gIC4uLnByb3BzXG59OiBTZWxlY3RQcm9wczxWVD4pIHtcbiAgY29uc3QgW3NlYXJjaFZhbHVlLCBzZXRTZWFyY2hWYWx1ZV0gPSB1c2VTdGF0ZTxzdHJpbmc+KCk7XG4gIC8vIGZvcmNlIHNob3cgc2VhcmNoIGlmIGNyZWF0YWJsZVxuICBjb25zdCBzaG93U2VhcmNoID0gc2hvd1NlYXJjaF8gfHwgY3JlYXRhYmxlO1xuICBjb25zdCBoYW5kbGVTZWFyY2ggPSBzaG93U2VhcmNoXG4gICAgPyAoaW5wdXQ6IHN0cmluZykgPT4ge1xuICAgICAgICBpZiAoY3JlYXRhYmxlKSB7XG4gICAgICAgICAgc2V0U2VhcmNoVmFsdWUoaW5wdXQpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvblNlYXJjaCkge1xuICAgICAgICAgIG9uU2VhcmNoKGlucHV0KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIDogdW5kZWZpbmVkO1xuXG4gIGNvbnN0IG9wdGlvbnNIYXNTZWFyY2hWYWx1ZSA9IG9wdGlvbnM/LnNvbWUoKFt2YWxdKSA9PiB2YWwgPT09IHNlYXJjaFZhbHVlKTtcbiAgY29uc3Qgb3B0aW9uc0hhc1ZhbHVlID0gb3B0aW9ucz8uc29tZSgoW3ZhbF0pID0+IHZhbCA9PT0gdmFsdWUpO1xuXG4gIGNvbnN0IGhhbmRsZUNoYW5nZTogU2VsZWN0UHJvcHM8VlQ+WydvbkNoYW5nZSddID0gc2hvd1NlYXJjaFxuICAgID8gKHZhbCwgb3B0KSA9PiB7XG4gICAgICAgIC8vIHJlc2V0IGlucHV0IHZhbHVlIG9uY2Ugc2VsZWN0ZWRcbiAgICAgICAgc2V0U2VhcmNoVmFsdWUoJycpO1xuICAgICAgICBpZiAob25DaGFuZ2UpIHtcbiAgICAgICAgICBvbkNoYW5nZSh2YWwsIG9wdCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICA6IG9uQ2hhbmdlO1xuXG4gIHJldHVybiAoXG4gICAgPEFudGRTZWxlY3Q8VlQ+XG4gICAgICBkcm9wZG93bk1hdGNoU2VsZWN0V2lkdGg9e2Ryb3Bkb3duTWF0Y2hTZWxlY3RXaWR0aH1cbiAgICAgIHNob3dTZWFyY2g9e3Nob3dTZWFyY2h9XG4gICAgICBvblNlYXJjaD17aGFuZGxlU2VhcmNofVxuICAgICAgb25DaGFuZ2U9e2hhbmRsZUNoYW5nZX1cbiAgICAgIHZhbHVlPXt2YWx1ZX1cbiAgICAgIHsuLi5wcm9wc31cbiAgICAgIGNzcz17e1xuICAgICAgICBtaW5XaWR0aCxcbiAgICAgIH19XG4gICAgPlxuICAgICAge29wdGlvbnM/Lm1hcCgoW3ZhbCwgbGFiZWxdKSA9PiAoXG4gICAgICAgIDxPcHRpb24gdmFsdWU9e3ZhbH0+e2xhYmVsfTwvT3B0aW9uPlxuICAgICAgKSl9XG4gICAgICB7Y2hpbGRyZW59XG4gICAgICB7dmFsdWUgJiYgIW9wdGlvbnNIYXNWYWx1ZSAmJiAoXG4gICAgICAgIDxPcHRpb24ga2V5PXt2YWx1ZX0gdmFsdWU9e3ZhbHVlfT5cbiAgICAgICAgICB7dmFsdWV9XG4gICAgICAgIDwvT3B0aW9uPlxuICAgICAgKX1cbiAgICAgIHtzZWFyY2hWYWx1ZSAmJiAhb3B0aW9uc0hhc1NlYXJjaFZhbHVlICYmIChcbiAgICAgICAgPE9wdGlvbiBrZXk9e3NlYXJjaFZhbHVlfSB2YWx1ZT17c2VhcmNoVmFsdWV9PlxuICAgICAgICAgIHsvKiBVbmZvcnR1bmF0ZWx5IEFudEQgc2VsZWN0IGRvZXMgbm90IHN1cHBvcnQgZGlzcGxheWluZyBkaWZmZXJlbnRcbiAgICAgICAgICBsYWJlbCBmb3Igb3B0aW9uIHZzIHNlbGVjdCB2YWx1ZSwgc28gd2UgY2FuJ3QgdXNlXG4gICAgICAgICAgYHQoJ0NyZWF0ZSBcIiVzXCInLCBzZWFyY2hWYWx1ZSlgIGhlcmUgKi99XG4gICAgICAgICAge3NlYXJjaFZhbHVlfVxuICAgICAgICA8L09wdGlvbj5cbiAgICAgICl9XG4gICAgPC9BbnRkU2VsZWN0PlxuICApO1xufVxuXG5TZWxlY3QuT3B0aW9uID0gT3B0aW9uO1xuIl19 */") }),


    options == null ? void 0 : options.map(([val, label]) =>
    ___EmotionJSX(Option, { value: val }, label)),

    children,
    value && !optionsHasValue &&
    ___EmotionJSX(Option, { key: value, value: value },
    value),


    searchValue && !optionsHasSearchValue &&
    ___EmotionJSX(Option, { key: searchValue, value: searchValue },



    searchValue)));




}__signature__(Select, "useState{[searchValue, setSearchValue]}");Select.propTypes = { creatable: _pt.bool, minWidth: _pt.oneOfType([_pt.string, _pt.number]), options: _pt.array };

Select.Option = Option;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(Option, "Option", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/components/Select.tsx");reactHotLoader.register(Select, "Select", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/components/Select.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();