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
import RowCountLabel, { RowCountLabelProps } from '.';

export default {
  title: 'RowCountLabel',
  component: RowCountLabel,
};

const options: { [key in string]: RowCountLabelProps } = {
  loading: {
    loading: true,
  },
  single: {
    rowcount: 1,
    limit: 100,
  },
  full: {
    rowcount: 100,
    limit: 100,
  },
  medium: {
    rowcount: 50,
    limit: 100,
  },
};

export const RowCountLabelGallery = () => (
  <>
    {Object.keys(options).map(name => (
      <>
        <h4>{name}</h4>
        <RowCountLabel
          loading={options[name].loading}
          rowcount={options[name].rowcount}
          limit={options[name].limit}
        />
      </>
    ))}
  </>
);
