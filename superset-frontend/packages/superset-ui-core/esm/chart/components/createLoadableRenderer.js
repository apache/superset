(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /*
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

import Loadable from 'react-loadable';






const defaultProps = {
  onRenderFailure() {},
  onRenderSuccess() {} };






export default function createLoadableRenderer(
options)
{
  const LoadableRenderer = Loadable.Map(options);

  // Extends the behavior of LoadableComponent to provide post-render listeners
  class CustomLoadableRenderer extends LoadableRenderer {


    componentDidMount() {
      this.afterRender();
    }

    componentDidUpdate() {
      this.afterRender();
    }

    afterRender() {
      const { loaded, loading, error } = this.state;
      const { onRenderFailure, onRenderSuccess } = this.props;
      if (!loading) {
        if (error) {
          onRenderFailure(error);
        } else if (loaded && Object.keys(loaded).length > 0) {
          onRenderSuccess();
        }
      }
    } // @ts-ignore
    __reactstandin__regenerateByEval(key, code) {// @ts-ignore
      this[key] = eval(code);}}CustomLoadableRenderer.defaultProps = void 0;
  CustomLoadableRenderer.defaultProps = defaultProps;
  CustomLoadableRenderer.preload = LoadableRenderer.preload;

  return CustomLoadableRenderer;
};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(defaultProps, "defaultProps", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/chart/components/createLoadableRenderer.ts");reactHotLoader.register(createLoadableRenderer, "createLoadableRenderer", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/chart/components/createLoadableRenderer.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();