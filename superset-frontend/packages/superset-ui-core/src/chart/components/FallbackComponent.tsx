/*
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

import React from 'react';
import { FallbackPropsWithDimension } from './SuperChart';

export type Props = FallbackPropsWithDimension;

const CONTAINER_STYLE = {
  backgroundColor: '#000',
  color: '#fff',
  overflow: 'auto',
  padding: 32,
};

export default function FallbackComponent({
  componentStack,
  error,
  height,
  width,
}: Props) {
  return (
    <div style={{ ...CONTAINER_STYLE, height, width }}>
      <div>
        <div>
          <b>Oops! An error occured!</b>
        </div>
        <code>{error ? error.toString() : 'Unknown Error'}</code>
      </div>
      {componentStack && (
        <div>
          <b>Stack Trace:</b>
          <code>
            {componentStack.split('\n').map((row: string) => (
              <div key={row}>{row}</div>
            ))}
          </code>
        </div>
      )}
    </div>
  );
}
