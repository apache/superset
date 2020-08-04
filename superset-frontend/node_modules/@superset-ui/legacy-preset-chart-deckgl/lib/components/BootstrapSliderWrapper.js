"use strict";

exports.__esModule = true;
exports.default = BootstrapSliderWrapper;

var _react = _interopRequireDefault(require("react"));

var _reactBootstrapSlider = _interopRequireDefault(require("react-bootstrap-slider"));

require("bootstrap-slider/dist/css/bootstrap-slider.min.css");

require("./BootstrapSliderWrapper.css");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
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
function BootstrapSliderWrapper(props) {
  return _react.default.createElement("span", {
    className: "BootstrapSliderWrapper"
  }, _react.default.createElement(_reactBootstrapSlider.default, props));
}