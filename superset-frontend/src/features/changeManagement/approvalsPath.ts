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
 * @fileoverview Where the Approvals page lives, written once.
 *
 * The page itself is contributed by the asset-approval extension, which
 * declares the path in its own manifest. These host surfaces -- the review
 * tag, the notification bell, the pending-reviews card, the capture toast --
 * only link to it, and each of them spelled the path out. That is six copies
 * of a string the host does not own, so moving the page meant finding them
 * all, and a deployment serving the page somewhere else had no single place
 * to say so.
 */

/** The contributed page's path, as its manifest declares it. */
const APPROVALS_PAGE = '/approvals';

/**
 * The path of the Approvals page, or of a path beneath it.
 *
 * Router-relative, so it suits `history.push` and an `href` alike, which is
 * what every caller passes it to today. It carries no `APPLICATION_ROOT`
 * prefix, matching what these links did before they were collected here;
 * adding one is a change of behaviour and belongs with the rest of that fix.
 *
 * @example
 * approvalsPath() // '/approvals/'
 * approvalsPath('submitted-by-me') // '/approvals/submitted-by-me'
 */
export function approvalsPath(subPath?: string): string {
  if (!subPath) {
    return `${APPROVALS_PAGE}/`;
  }
  return `${APPROVALS_PAGE}/${subPath.replace(/^\/+/, '')}`;
}
