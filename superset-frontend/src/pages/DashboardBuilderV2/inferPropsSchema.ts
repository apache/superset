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
import type { JsonSchema7 } from '@jsonforms/core';

/**
 * One value's type, or `undefined` where the value does not carry one.
 *
 * `null` is the case that matters: it says a key exists and nothing else.
 * Calling it a string would make the first edit a silent change of type, and
 * calling it an object would render a group with no fields in it.
 */
function describe(value: unknown): JsonSchema7 | undefined {
  if (typeof value === 'string') return { type: 'string' };
  if (typeof value === 'boolean') return { type: 'boolean' };
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { type: 'number' };
  }
  if (Array.isArray(value)) {
    // Typed by its first element, which is the only element there is to read.
    // A list holding more than one shape renders as the first one — a JSON
    // question that the JSON half of the panel is the place to answer.
    return { type: 'array', items: describe(value[0]) ?? {} };
  }
  if (typeof value === 'object' && value !== null) {
    const properties: Record<string, JsonSchema7> = {};
    for (const [key, held] of Object.entries(value)) {
      const described = describe(held);
      if (described !== undefined) {
        properties[key] = described;
      }
    }
    return { type: 'object', properties };
  }
  return undefined;
}

/**
 * A block's properties, described as a JSON Schema so they can be edited in a
 * form instead of in a string of JSON.
 *
 * Read off the values rather than declared per block type, and deliberately
 * so: `BuildingBlockView` resolves a renderer through a registry an extension
 * writes into, and a schema per type would make this panel the one place that
 * has to learn every type there is — the exact knowledge the render path is
 * built not to have. A schema shipped alongside each registration would be
 * better still, and this is what stands in until there is one: it describes
 * whatever the block is holding, built-in or contributed, with no list to
 * keep current.
 *
 * What it cannot do is invent a key that is not there. A property nothing has
 * written yet has no value to read a type off, so it does not appear — which
 * is the JSON editor's half of the same panel: that one edits the shape, this
 * one edits the values in it.
 */
export default function inferPropsSchema(
  props: Record<string, unknown> | undefined,
): JsonSchema7 {
  // A record is always an object, so this branch of `describe` always answers.
  return describe(props ?? {}) as JsonSchema7;
}

/**
 * The keys `inferPropsSchema` declined, so the form can say what it is not
 * showing rather than quietly dropping it.
 */
export function untypedKeys(
  props: Record<string, unknown> | undefined,
): string[] {
  return Object.entries(props ?? {})
    .filter(([, value]) => describe(value) === undefined)
    .map(([key]) => key);
}
