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
import React from 'react';
import { Select } from 'antd';
import querystring from 'querystring';

const { Option } = Select;

const versions = ['1', '2'];

export default function VersionSelect() {
  const { version } = querystring.parse(window.location.search.substr(1));
  const handleChange = (e) => {
    // @ts-ignore
    window.location = `/docs/intro?version=${e}`;
  };
  return (
    <div>
      version:
      <Select
        defaultValue={version || 1}
        style={{ width: 120 }}
        onChange={handleChange}
      >
        {versions.map((e) => (
          <Option value={e}>{e}</Option>
        ))}
      </Select>
    </div>
  );
}
