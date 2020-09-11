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
import React, { useEffect, useState } from 'react';

/**
 * Create an asynchronously imported component, will re-render once import is
 * complete.
 */
export default function AsyncEsmComponent<P = {}>(
  /**
   * A promise generator that returns the React component to render.
   */
  loadComponent:
    | Promise<React.ComponentType<P>>
    | (() => Promise<React.ComponentType<P>>),
  /**
   * Placeholder while still importing.
   */
  placeholder?: React.ComponentType<P>,
) {
  let component: React.ComponentType<P>;
  let promise: Promise<typeof component>;

  // load component on initialization
  if (loadComponent instanceof Promise) {
    promise = loadComponent;
    promise.then(loadedComponent => {
      component = loadedComponent;
    });
  }

  return function AsyncComponent(props: P) {
    const [loaded, setLoaded] = useState(component !== undefined);
    useEffect(() => {
      if (!loaded) {
        if (!promise && typeof loadComponent === 'function') {
          promise = loadComponent();
          // save to cache cache
          promise.then(loadedComponent => {
            component = loadedComponent;
          });
        }
        // update state to trigger a re-render
        promise.then(() => {
          setLoaded(true);
        });
      }
    });
    const Component = component || placeholder;
    return Component ? <Component {...props} /> : null;
  };
}
