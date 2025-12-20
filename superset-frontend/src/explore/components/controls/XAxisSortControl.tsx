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
import { useEffect, useState } from 'react';
import SelectControl from './SelectControl';

interface XAxisSortControlProps {
  onChange: (val: string | undefined) => void;
  value: string | null;
  shouldReset: boolean;
  name?: string;
  [key: string]: unknown;
}

export default function XAxisSortControl(props: XAxisSortControlProps) {
  const [value, setValue] = useState(props.value);
  useEffect(() => {
    if (props.shouldReset) {
      props.onChange(undefined);
      setValue(null);
    }
  }, [props.shouldReset, props.value]);

  return <SelectControl {...props} name={props.name ?? 'x_axis_sort'} value={value} />;
}
