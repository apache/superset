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
import React, {
  ComponentType,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ExtraControlProps,
  sharedControlComponents,
} from '@superset-ui/chart-controls';
import { JsonArray, JsonValue, t } from '@superset-ui/core';
import { ControlProps } from 'src/explore/components/Control';
import builtInControlComponents from 'src/explore/components/controls';

/**
 * Full control component map.
 */
const controlComponentMap = {
  ...builtInControlComponents,
  ...sharedControlComponents,
};

export type SharedControlComponent = keyof typeof controlComponentMap;

/**
 * The actual props passed to the control component itself
 * (not src/explore/components/Control.tsx).
 */
export type ControlPropsWithExtras = Omit<ControlProps, 'type'> &
  ExtraControlProps;

/**
 * The full props passed to control component. Including withAsyncVerification
 * related props and `onChange` event + `hovered` state from Control.tsx.
 */
export type FullControlProps = ControlPropsWithExtras & {
  onChange?: (value: JsonValue) => void;
  hovered?: boolean;
  /**
   * An extra flag for triggering async verification. Set it in mapStateToProps.
   */
  needAsyncVerification?: boolean;
  /**
   * Whether to show loading state when verification is still loading.
   */
  showLoadingState?: boolean;
  verify?: AsyncVerify;
};

/**
 * The async verification function that accepts control props and returns a
 * promise resolving to extra props if overrides are needed.
 */
export type AsyncVerify = (
  props: ControlPropsWithExtras,
) => Promise<ExtraControlProps | undefined | null>;

/**
 * Whether the extra props will update the original props.
 */
function hasUpdates(
  props: ControlPropsWithExtras,
  newProps: ExtraControlProps,
) {
  return (
    props !== newProps &&
    Object.entries(newProps).some(([key, value]) => {
      if (Array.isArray(props[key]) && Array.isArray(value)) {
        const sourceValue: JsonArray = props[key];
        return (
          sourceValue.length !== value.length ||
          sourceValue.some((x, i) => x !== value[i])
        );
      }
      if (key === 'formData') {
        return JSON.stringify(props[key]) !== JSON.stringify(value);
      }
      return props[key] !== value;
    })
  );
}

export type WithAsyncVerificationOptions = {
  baseControl:
    | SharedControlComponent
    // allows custom `baseControl` to not handle some of the <Control />
    // component props.
    | ComponentType<Partial<FullControlProps>>;
  showLoadingState?: boolean;
  quiet?: boolean;
  verify?: AsyncVerify;
  onChange?: (value: JsonValue, props: ControlPropsWithExtras) => void;
};

/**
 * Wrap Control with additional async verification. The <Control /> component
 * will render twice, once with the original props, then later with the updated
 * props after the async verification is finished.
 *
 * @param baseControl - The base control component.
 * @param verify - An async function that returns a Promise which resolves with
 *                 the updated and verified props. You should handle error within
 *                 the promise itself. If the Promise returns nothing or null, then
 *                 the control will not rerender.
 * @param onChange - Additional event handler when values are changed by users.
 * @param quiet    - Whether to show a warning toast when verification failed.
 */
export default function withAsyncVerification({
  baseControl,
  onChange,
  verify: defaultVerify,
  quiet = false,
  showLoadingState: defaultShowLoadingState = true,
}: WithAsyncVerificationOptions) {
  const ControlComponent: ComponentType<FullControlProps> =
    typeof baseControl === 'string'
      ? controlComponentMap[baseControl]
      : baseControl;

  return function ControlWithVerification(props: FullControlProps) {
    const {
      hovered,
      onChange: basicOnChange,
      needAsyncVerification = false,
      isLoading: initialIsLoading = false,
      showLoadingState = defaultShowLoadingState,
      verify = defaultVerify,
      ...restProps
    } = props;
    const otherPropsRef = useRef(restProps);
    const [verifiedProps, setVerifiedProps] = useState({});
    const [isLoading, setIsLoading] = useState<boolean>(initialIsLoading);
    const { addWarningToast } = restProps.actions;

    // memoize `restProps`, so that verification only triggers when material
    // props are actually updated.
    let otherProps = otherPropsRef.current;
    if (hasUpdates(otherProps, restProps)) {
      otherProps = otherPropsRef.current = restProps;
    }

    const handleChange = useCallback(
      (value: JsonValue) => {
        // the default onChange handler, triggers the `setControlValue` action
        if (basicOnChange) {
          basicOnChange(value);
        }
        if (onChange) {
          onChange(value, { ...otherProps, ...verifiedProps });
        }
      },
      [basicOnChange, otherProps, verifiedProps],
    );

    useEffect(() => {
      if (needAsyncVerification && verify) {
        if (showLoadingState) {
          setIsLoading(true);
        }
        verify(otherProps)
          .then(updatedProps => {
            if (showLoadingState) {
              setIsLoading(false);
            }
            if (updatedProps && hasUpdates(otherProps, updatedProps)) {
              setVerifiedProps({
                // save isLoading in combination with other props to avoid
                // rendering twice.
                ...updatedProps,
              });
            }
          })
          .catch((err: Error | string) => {
            if (showLoadingState) {
              setIsLoading(false);
            }
            if (!quiet && addWarningToast) {
              addWarningToast(
                t(
                  'Failed to verify select options: %s',
                  (typeof err === 'string' ? err : err.message) ||
                    t('[unknown error]'),
                ),
                { noDuplicate: true },
              );
            }
          });
      }
    }, [
      needAsyncVerification,
      showLoadingState,
      verify,
      otherProps,
      addWarningToast,
    ]);

    return (
      <ControlComponent
        isLoading={isLoading}
        hovered={hovered}
        onChange={handleChange}
        {...otherProps}
        {...verifiedProps}
      />
    );
  };
}
