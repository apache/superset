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
import isEqual from 'lodash-es/isEqual';
import type {
  AutomaticNormalizationTransition,
  AutomaticNormalizationTransitions,
  ChartNormalizationTrackingState,
  JsonValue,
} from './types';

const isJsonValueInternal = (
  value: unknown,
  ancestors: WeakSet<object>,
): value is JsonValue => {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return true;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (typeof value !== 'object' || ancestors.has(value)) {
    return false;
  }

  ancestors.add(value);
  let isJsonCompatible: boolean;
  if (Array.isArray(value)) {
    isJsonCompatible = value.every(item =>
      isJsonValueInternal(item, ancestors),
    );
  } else {
    const prototype = Object.getPrototypeOf(value);
    isJsonCompatible =
      (prototype === Object.prototype || prototype === null) &&
      Object.values(value).every(item => isJsonValueInternal(item, ancestors));
  }
  ancestors.delete(value);
  return isJsonCompatible;
};

export const isJsonValue = (value: unknown): value is JsonValue =>
  isJsonValueInternal(value, new WeakSet());

/** Structural equality for JSON values, independent of object key order. */
export const jsonValuesEqual = (left: unknown, right: unknown) =>
  isEqual(left, right);

interface NormalizationSnapshots {
  control: string;
  persisted: Record<string, unknown>;
  input: Record<string, unknown>;
  hydrated: Record<string, unknown>;
}

const automaticNormalizationTransition = ({
  control,
  persisted,
  input,
  hydrated,
}: NormalizationSnapshots): AutomaticNormalizationTransition | undefined => {
  const fromPresent = Object.hasOwn(persisted, control);
  const inputPresent = Object.hasOwn(input, control);
  const toPresent = Object.hasOwn(hydrated, control);
  const fromValue = persisted[control];
  const inputValue = input[control];
  const toValue = hydrated[control];

  const inputMatchesPersisted =
    fromPresent === inputPresent && jsonValuesEqual(fromValue, inputValue);
  const hydrationChangedValue =
    fromPresent !== toPresent || !jsonValuesEqual(fromValue, toValue);

  // Disappearing keys (!toPresent) are deliberately not covered here:
  // hydration itself never removes keys from the merged snapshot. Machine
  // removals used to happen later, when StashFormDataContainer stashed
  // invisible controls out of form_data, but the save path now always
  // merges the stash back in, so a save can no longer drop those keys.
  if (!inputMatchesPersisted || !toPresent || !hydrationChangedValue) {
    return undefined;
  }
  if (!isJsonValue(toValue)) {
    return undefined;
  }

  if (!fromPresent) {
    return {
      control,
      from_present: false,
      to_present: true,
      to_value: toValue,
    };
  }
  if (!isJsonValue(fromValue)) {
    return undefined;
  }
  return {
    control,
    from_present: true,
    from_value: fromValue,
    to_present: true,
    to_value: toValue,
  };
};

export const automaticNormalizationTransitions = (
  persisted: Record<string, unknown>,
  input: Record<string, unknown>,
  hydrated: Record<string, unknown>,
): AutomaticNormalizationTransitions => {
  const transitions: AutomaticNormalizationTransitions = {};
  const controls = new Set([...Object.keys(input), ...Object.keys(hydrated)]);
  controls.forEach(control => {
    const transition = automaticNormalizationTransition({
      control,
      persisted,
      input,
      hydrated,
    });
    if (transition) {
      transitions[control] = transition;
    }
  });
  return transitions;
};

export const matchingAutomaticNormalizationTransitions = (
  tracking: ChartNormalizationTrackingState | null | undefined,
  formData: Record<string, unknown>,
): AutomaticNormalizationTransitions =>
  Object.fromEntries(
    Object.entries(tracking?.transitions ?? {}).filter(
      ([control, transition]) =>
        !tracking?.invalidatedControls[control] &&
        Object.hasOwn(formData, control) === transition.to_present &&
        (!transition.to_present ||
          jsonValuesEqual(formData[control], transition.to_value)),
    ),
  );
