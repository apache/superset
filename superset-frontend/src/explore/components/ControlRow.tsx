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
import React, { useCallback } from 'react';

const NUM_COLUMNS = 12;

type Control = React.ReactElement | null;

export default function ControlRow({ controls }: { controls: Control[] }) {
  const isHiddenControl = useCallback(
    (control: Control) =>
      control?.props.type === 'HiddenControl' ||
      control?.props.isVisible === false,
    [],
  );
  // Invisible control should not be counted
  // in the columns number
  const countableControls = controls.filter(
    control => !isHiddenControl(control),
  );
  const colSize = countableControls.length
    ? NUM_COLUMNS / countableControls.length
    : NUM_COLUMNS;
  return (
    <div className="row">
      {controls.map((control, i) => (
        <div
          className={`col-lg-${colSize} col-xs-12`}
          style={{
            display: isHiddenControl(control) ? 'none' : 'block',
          }}
          key={i}
        >
          {control}
        </div>
      ))}
    </div>
  );
}
