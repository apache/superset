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
import { type ReactNode } from 'react';
import { ensureIsArray } from '@superset-ui/core';
import {
  OWNER_TEXT_LABEL_PROP,
  OWNER_EMAIL_PROP,
} from 'src/features/owners/OwnerSelectLabel';

/**
 * An owners AsyncSelect option. The `label` is the rendered `OwnerSelectLabel`
 * React element (not a string), so the plain-text name is carried separately on
 * `OWNER_TEXT_LABEL_PROP` for the options the component constructs.
 */
export type OwnerOption = {
  value: number;
  label: ReactNode;
  [OWNER_TEXT_LABEL_PROP]?: string;
  [OWNER_EMAIL_PROP]?: string;
};

export type ParsedOwner = {
  id: number;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
};

/**
 * Resolve the owner objects to persist when the owners AsyncSelect changes.
 *
 * AsyncSelect only caches the options the user has actually loaded or searched,
 * so `options` can be a partial set that is missing owners which only ever
 * existed in the controlled `value` prop. We therefore prefer the full owner
 * object already in component state (it carries the real name/email from the
 * API) and only fall back to the option cache — and finally a string label —
 * for genuinely new owners. This prevents a removed owner from collapsing the
 * remaining owners into nameless entries.
 */
export function parseSelectedOwners(
  selectedOwners: OwnerOption[],
  options: OwnerOption[],
  existingOwners: ParsedOwner[],
): ParsedOwner[] {
  const optionsById = new Map(options.map(opt => [opt.value, opt]));
  return ensureIsArray(selectedOwners).map(o => {
    const existingOwner = existingOwners.find(ow => ow.id === o.value);
    if (existingOwner) {
      return existingOwner;
    }
    const opt = optionsById.get(o.value);
    return {
      id: o.value,
      full_name:
        opt?.[OWNER_TEXT_LABEL_PROP] ||
        // `label` is a React element unless the option came from a plain-text
        // source, so only use it as a name when it is actually a string.
        (typeof o.label === 'string' ? o.label : ''),
      // Leave email undefined when the option carries no email, rather than
      // fabricating an empty string — keeps the optional `email?` type honest.
      email: opt?.[OWNER_EMAIL_PROP] ?? undefined,
    };
  });
}
