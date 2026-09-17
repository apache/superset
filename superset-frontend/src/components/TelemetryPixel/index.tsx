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
}

/**
 * Renders a telemetry pixel component to capture anonymous, aggregated telemetry via Scarf.
 * This can be disabled by setting the SCARF_ANALYTICS environment variable to false.
 *
 * @component
 * @param {TelemetryPixelProps} props - The props for the TelemetryPixel component.
 * @param {string} props.version - The version of  Superset that's currently in use.
 * @param {string} props.sha - The SHA of Superset that's currently in use.
 * @param {string} props.build - The build of Superset that's currently in use.
 * @returns {JSX.Element | null} The rendered TelemetryPixel component.
 */

const PIXEL_ID = '0d3461e1-abb1-4691-a0aa-5ed50de66af0';

const TelemetryPixel = ({
  version = 'unknownVersion',
  sha = 'unknownSHA',
  build = 'unknownBuild',
}: TelemetryPixelProps): ReactElement | null => {
  const pixelPath = `https://apachesuperset.gateway.scarf.sh/pixel/${PIXEL_ID}/${version}/${sha}/${build}`;
  return process.env.SCARF_ANALYTICS === 'false' ? null : (
    <img
      // @ts-ignore
      referrerPolicy="no-referrer-when-downgrade"
      src={pixelPath}
      width={0}
      height={0}
      alt=""
    />
  );
};
export default TelemetryPixel;
