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

/**
 * @fileoverview The notice an artifact's editors get when the policy in force
 * no longer admits all of the build its frame serves. The frame is served all
 * the same, unless an admin enforces the policy or a security revocation
 * withdraws the build; publishing such a version again is refused.
 */

import { components, translation } from '@apache-superset/core';
import type { FrameLink } from './api';

const { Alert } = components;
const { t } = translation;

export default function OutOfPolicy({ link }: { link: FrameLink }) {
  const reasons = link.out_of_policy ?? [];
  if (!link.can_edit || reasons.length === 0) return null;
  return (
    <Alert type="warning" closable={false}>
      {t(
        'This version is out of policy, and is shown until an admin enforces the policy: %s',
        reasons.join('; '),
      )}
    </Alert>
  );
}
