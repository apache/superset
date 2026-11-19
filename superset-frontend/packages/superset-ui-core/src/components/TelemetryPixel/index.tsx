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

import { ReactElement } from 'react';

interface TelemetryPixelProps {
  version?: string;
  sha?: string;
  build?: string;
  enabled?: boolean;
}

/**
 * Renders a telemetry pixel component to capture anonymous, aggregated telemetry via Scarf.
 *
 * Telemetry can be disabled in two ways:
 * - At build time, by setting the SCARF_ANALYTICS environment variable to `false`
 *   (inlined by webpack; only effective when building the frontend yourself).
 * - At runtime, by passing `enabled={false}`, which the app derives from the
 *   `SCARF_ANALYTICS` backend config exposed via the bootstrap payload. This is
 *   what allows opting out in pre-built images, where the build-time flag is fixed.
 *
 * @component
 * @param {TelemetryPixelProps} props - The props for the TelemetryPixel component.
 * @param {string} props.version - The version of  Superset that's currently in use.
 * @param {string} props.sha - The SHA of Superset that's currently in use.
 * @param {string} props.build - The build of Superset that's currently in use.
 * @param {boolean} props.enabled - Runtime opt-out switch; when false the pixel is not rendered.
 * @returns {JSX.Element | null} The rendered TelemetryPixel component.
 */

const PIXEL_ID = '0d3461e1-abb1-4691-a0aa-5ed50de66af0';

export const TelemetryPixel = ({
  version = 'unknownVersion',
  sha = 'unknownSHA',
  build = 'unknownBuild',
  enabled = true,
}: TelemetryPixelProps): ReactElement | null => {
  // Use Scarf's native static pixel directly rather than the gateway redirect
  // (apachesuperset.gateway.scarf.sh), which some browsers/extensions flag as a
  // tracking redirect. The gateway route forwards to this same static endpoint.
  const pixelPath =
    `https://static.scarf.sh/a.png?x-pxid=${PIXEL_ID}` +
    `&version=${encodeURIComponent(version)}` +
    `&sha=${encodeURIComponent(sha)}` +
    `&build=${encodeURIComponent(build)}`;
  const disabled = !enabled || process.env.SCARF_ANALYTICS === 'false';
  return disabled ? null : (
    <img
      referrerPolicy="no-referrer-when-downgrade"
      src={pixelPath}
      width={0}
      height={0}
      alt=""
    />
  );
};
