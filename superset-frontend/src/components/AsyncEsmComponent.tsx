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

type PlaceholderProps = {
  width?: string | number;
  height?: string | number;
} & {
  [key: string]: any;
};

function DefaultPlaceholder({ width, height }: PlaceholderProps) {
  // `|| null` is for in case of width=0 or height=0.
  return (width && height && <div style={{ width, height }} />) || null;
}

/**
 * Asynchronously import an ES module as a React component, render a placeholder
 * first (if provided) and re-render once import is complete.
 */
export default function AsyncEsmComponent<
  P = PlaceholderProps,
  M = React.ComponentType<P> | { default: React.ComponentType<P> }
>(
  /**
   * A promise generator that returns the React component to render.
   */
  loadComponent: Promise<M> | (() => Promise<M>),
  /**
   * Placeholder while still importing.
   */
  placeholder: React.ComponentType<P> | null = DefaultPlaceholder,
) {
  let component: React.ComponentType<P>;
  let promise: Promise<M> | undefined;

  /**
   * Safely wait for promise, make sure the loader function only execute once.
   */
  function waitForPromise() {
    if (!promise) {
      // load component on initialization
      promise =
        loadComponent instanceof Promise ? loadComponent : loadComponent();
    }
    promise.then(result => {
      component = ((result as { default?: React.ComponentType<P> }).default ||
        result) as React.ComponentType<P>;
    });
    return promise;
  }

  function AsyncComponent(props: P) {
    const [loaded, setLoaded] = useState(component !== undefined);
    useEffect(() => {
      if (!loaded) {
        // update state to trigger a re-render
        waitForPromise().then(() => {
          setLoaded(true);
        });
      }
    });
    const Component = component || placeholder;
    return Component ? <Component {...props} /> : null;
  }
  AsyncComponent.load = waitForPromise;

  return AsyncComponent;
}
