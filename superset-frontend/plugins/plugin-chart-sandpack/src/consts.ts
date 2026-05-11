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
import { debounce } from 'lodash';
import { Constants } from '@superset-ui/core/components';

export const debounceFunc = debounce(
  (func: (val: string) => void, source: string) => func(source),
  Constants.SLOW_DEBOUNCE,
);

export const DEFAULT_APP_CODE = `import data from './data.json';

export default function App() {
  return (
    <div style={{ fontFamily: 'system-ui', padding: 16 }}>
      <h2>Rows: {data.length}</h2>
      <ul>
        {data.slice(0, 20).map((row, i) => (
          <li key={i}>{JSON.stringify(row)}</li>
        ))}
      </ul>
    </div>
  );
}
`;

export const DEFAULT_DEPENDENCIES = `{
  "react": "^18.2.0",
  "react-dom": "^18.2.0"
}
`;
