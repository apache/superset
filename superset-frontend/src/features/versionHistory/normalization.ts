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
  // removals happen later, when StashFormDataContainer stashes invisible
  // controls out of form_data — those are covered at save time by
  // stashDropNormalizationTransitions, which uses the stash itself
  // (explore.hiddenFormData) as the proof the removal was not user-made.
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

/**
 * Advisory transitions for keys the stash removed from form_data.
 *
 * StashFormDataContainer moves an invisible control's value out of
 * ``form_data`` into ``explore.hiddenFormData``. That removal is
 * machine-made by construction, but it happens in render effects after
 * hydration, so hydration-time tracking cannot see it. This computes the
 * matching drop transitions at save time: a key counts only when the stash
 * holds it, the stashed value still equals the persisted value (a user edit
 * before hiding breaks the equality and stays recorded), and the outgoing
 * payload no longer carries the key. Keys absent from the stash — e.g.
 * removed by a viz-type switch — are never covered.
 */
export const stashDropNormalizationTransitions = (
  persisted: Record<string, unknown>,
  hiddenFormData: Record<string, unknown> | undefined,
  outgoingFormData: Record<string, unknown>,
): AutomaticNormalizationTransitions => {
  const transitions: AutomaticNormalizationTransitions = {};
  if (!hiddenFormData) {
    return transitions;
  }
  Object.keys(hiddenFormData).forEach(control => {
    if (!Object.hasOwn(persisted, control)) return;
    if (Object.hasOwn(outgoingFormData, control)) return;
    const fromValue = persisted[control];
    if (!isJsonValue(fromValue)) return;
    if (!jsonValuesEqual(hiddenFormData[control], fromValue)) return;
    transitions[control] = {
      control,
      from_present: true,
      from_value: fromValue,
      to_present: false,
    };
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
