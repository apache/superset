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

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from 'react';
import type {
  ComponentType,
  WeakValidationMap,
  ForwardRefExoticComponent,
  PropsWithoutRef,
  RefAttributes,
} from 'react';

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

export type ReactifyProps = {
  id?: string;
  className?: string;
};

// TODO: add more React lifecycle callbacks as needed
export type LifeCycleCallbacks = {
  componentWillUnmount?: () => void;
};

export interface RenderFuncType<Props> {
  (container: HTMLDivElement, props: Readonly<Props & ReactifyProps>): void;
  displayName?: string;
  defaultProps?: Partial<Props & ReactifyProps>;
  propTypes?: WeakValidationMap<Props & ReactifyProps>;
}

export interface ReactifiedComponentRef {
  container?: HTMLDivElement;
}

export type ReactifiedComponent<Props> = ForwardRefExoticComponent<
  PropsWithoutRef<Props & ReactifyProps> & RefAttributes<ReactifiedComponentRef>
>;

// Return the widest public type that covers "use it as a React component" so
// TypeScript JSX callers and `ComponentType<...>`-typed variables still compile;
// callers with explicit `ComponentClass<...>` annotations must widen to
// `ComponentType`. Those wanting the forwardRef surface can narrow to
// `ReactifiedComponent<Props>` explicitly.
export default function reactify<Props extends object>(
  renderFn: RenderFuncType<Props>,
  callbacks?: LifeCycleCallbacks,
): ComponentType<Props & ReactifyProps> {
  const ReactifiedComponent = forwardRef<
    ReactifiedComponentRef,
    Props & ReactifyProps
  >(function ReactifiedComponent(props, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    // Keep the latest props available to the unmount callback — legacy
    // consumers read values off `this.props` (e.g. ReactNVD3 uses id).
    // Update the ref in a layout effect rather than during render so the
    // assignment only happens for committed renders (safe under Concurrent
    // Mode) and is in place before the passive unmount effect reads it.
    const propsRef = useRef(props);
    useLayoutEffect(() => {
      propsRef.current = props;
    });

    // Expose container via ref for external access
    useImperativeHandle(
      ref,
      () => ({
        get container() {
          return containerRef.current ?? undefined;
        },
      }),
      [],
    );

    // Execute renderFn on mount and every update (mimics componentDidMount + componentDidUpdate)
    useEffect(() => {
      if (containerRef.current) {
        // `forwardRef` widens the props parameter to `PropsWithoutRef<...>`,
        // which TypeScript can't narrow back to `Props & ReactifyProps` when
        // `Props` is a generic `object`. The values are identical at runtime,
        // so assert the original prop shape for `renderFn`.
        renderFn(
          containerRef.current,
          props as Readonly<Props & ReactifyProps>,
        );
      }
    });

    // Cleanup on unmount
    useEffect(
      () => () => {
        if (callbacks?.componentWillUnmount) {
          // Preserve legacy behavior where `this` was a component instance
          // exposing `props`. The class version cleared `this.container`
          // before invoking componentWillUnmount, so mirror that here to
          // prevent callbacks from touching a DOM node that's being torn
          // down.
          callbacks.componentWillUnmount.call({
            container: undefined,
            props: propsRef.current,
          });
        }
      },
      [],
    );

    const { id, className } = props;

    return <div ref={containerRef} id={id} className={className} />;
  });

  if (renderFn.displayName) {
    ReactifiedComponent.displayName = renderFn.displayName;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- forwardRef static field types don't line up with renderFn's validator types
  const result = ReactifiedComponent as any;

  if (renderFn.propTypes) {
    result.propTypes = {
      ...result.propTypes,
      ...renderFn.propTypes,
    };
  }

  if (renderFn.defaultProps) {
    result.defaultProps = renderFn.defaultProps;
  }

  return result as unknown as ComponentType<Props & ReactifyProps>;
}
