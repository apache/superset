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
 * Get the available versions of WFS and WMS.
 *
 * @returns the versions
 */
export const getServiceVersions = () => ({
  WMS: ['1.3.0', '1.1.1'],
  WFS: ['2.0.2', '2.0.0', '1.1.0'],
});

/**
 * Checks if a given version is below the comparer version.
 *
 * @param version The version to check.
 * @param below The version to compare to.
 * @param serviceType The service type.
 * @returns True, if the version is below comparer version. False, otherwise.
 */
export const isVersionBelow = (
  version: string,
  below: string,
  serviceType: 'WFS' | 'WMS',
) => {
  const versions = getServiceVersions()[serviceType];
  // versions is ordered from newest to oldest, so we invert the order
  // to improve the readability of this function.
  versions.reverse();
  const versionIdx = versions.indexOf(version);
  if (versionIdx === -1) {
    // TODO: consider throwing an error instead
    return false;
  }
  const belowIdx = versions.indexOf(below);
  if (belowIdx === -1) {
    // TODO: consider throwing an error instead
    return false;
  }

  return versionIdx < belowIdx;
};
