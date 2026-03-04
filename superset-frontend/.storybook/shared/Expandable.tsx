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

import { useState, useCallback, ReactNode } from 'react';

export type Props = {
  children: ReactNode;
  expandableWhat?: string;
};

export default function Expandable({ children, expandableWhat }: Props) {
  const [open, setOpen] = useState(false);

  const handleToggle = useCallback(() => {
    setOpen(prevOpen => !prevOpen);
  }, []);

  return (
    <div>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={handleToggle}
      >
        {`${open ? 'Hide' : 'Show'} ${expandableWhat}`}
      </button>
      <br />
      <br />
      {open ? children : null}
    </div>
  );
}
