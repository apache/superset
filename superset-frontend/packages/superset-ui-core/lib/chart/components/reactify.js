import _pt from "prop-types";(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /*
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

// TODO: Note that id and className can collide between Props and ReactifyProps
// leading to (likely) unexpected behaviors. We should either require Props to not
// contain an id/className, or not combine them (via intersection), instead preferring
// wrapping (composition). As an example:
// interface MyProps {
//   id: number;
// }
// function myRender(container: HTMLDivElement, props: Readonly<MyProps>): void {
//   props.id // unusable: id is string & number
// }
// new (reactify(myRender))({ id: 5 }); // error: id has to be string & number
import { jsx as ___EmotionJSX } from "@emotion/react";

















export default function reactify(
renderFn,
callbacks)
{
  class ReactifiedComponent extends React.Component {


    constructor(props) {
      super(props);this.container = void 0;
      this.setContainerRef = this.setContainerRef.bind(this);
    }

    componentDidMount() {
      this.execute();
    }

    componentDidUpdate() {
      this.execute();
    }

    componentWillUnmount() {
      this.container = undefined;
      if (callbacks != null && callbacks.componentWillUnmount) {
        callbacks.componentWillUnmount.bind(this)();
      }
    }

    setContainerRef(ref) {
      this.container = ref;
    }

    execute() {
      if (this.container) {
        renderFn(this.container, this.props);
      }
    }

    render() {
      const { id, className } = this.props;

      return ___EmotionJSX("div", { ref: this.setContainerRef, id: id, className: className });
    } // @ts-ignore
    __reactstandin__regenerateByEval(key, code) {// @ts-ignore
      this[key] = eval(code);}}ReactifiedComponent.propTypes = { id: _pt.string, className: _pt.string };
  const ReactifiedClass =
  ReactifiedComponent;

  if (renderFn.displayName) {
    ReactifiedClass.displayName = renderFn.displayName;
  }
  // eslint-disable-next-line react/forbid-foreign-prop-types
  if (renderFn.propTypes) {
    ReactifiedClass.propTypes = {
      ...ReactifiedClass.propTypes,
      ...renderFn.propTypes };

  }
  if (renderFn.defaultProps) {
    ReactifiedClass.defaultProps = renderFn.defaultProps;
  }

  return ReactifiedComponent;
};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(reactify, "reactify", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/chart/components/reactify.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();