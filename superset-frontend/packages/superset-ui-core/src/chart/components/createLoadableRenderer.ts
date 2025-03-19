/*
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
import { ComponentClass } from 'react';

export type LoadableRendererProps = {
  onRenderFailure?: Function;
  onRenderSuccess?: Function;
};

const defaultProps = {
  onRenderFailure() {},
  onRenderSuccess() {},
};

export interface LoadableRenderer<Props>
  extends ComponentClass<Props & LoadableRendererProps>,
    Loadable.LoadableComponent {}

export default function createLoadableRenderer<
  Props,
  Exports extends { [key: string]: any },
>(options: Loadable.OptionsWithMap<Props, Exports>): LoadableRenderer<Props> {
  const LoadableRenderer = Loadable.Map<Props, Exports>(
    options,
  ) as LoadableRenderer<Props>;

  // Extends the behavior of LoadableComponent to provide post-render listeners
  class CustomLoadableRenderer extends LoadableRenderer {
    static defaultProps: object;

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
          (onRenderFailure as Function)(error);
        } else if (loaded && Object.keys(loaded).length > 0) {
          (onRenderSuccess as Function)();
        }
      }
    }
  }

  CustomLoadableRenderer.defaultProps = defaultProps;
  CustomLoadableRenderer.preload = LoadableRenderer.preload;

  return CustomLoadableRenderer;
}
