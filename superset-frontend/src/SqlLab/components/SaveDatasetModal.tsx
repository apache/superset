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

import React, { useState } from 'react';
import { Radio, AutoComplete, Input } from 'src/common/components';
import Modal from 'src/common/components/Modal';

const mockVal = (str, repeat = 1) => {
  return {
    value: str.repeat(repeat),
  };
};

// eslint-disable-next-line no-empty-pattern
export const SaveDatasetModal = ({}) => {
  const [value, setValue] = useState('');
  const [options, setOptions] = useState([]);

  const onSearch = (searchText) => {
    setOptions(
      !searchText ? [] : [mockVal(searchText), mockVal(searchText, 2), mockVal(searchText, 3)],
    );
  };

  const onSelect = (data) => {
    console.log('onSelect', data);
  };

  const onChange = (data) => {
    setValue(data);
  };

  return (
    <Modal show onHide={() => {}} title="Save a new dataset">
      <div>
        To explore the results of this query, we need to save it as a virtual dataset
        <Radio>Save as new dataset</Radio>
        <Input style={{ width: 200 }} defaultValue="my_new_dataset_A" />
        <br/>
        <Radio>Overwrite existing dataset</Radio>
        <AutoComplete
          options={options}
          style={{
            width: 200,
          }}
          onSelect={onSelect}
          onSearch={onSearch}
          placeholder="input here"
      />
      </div>
    </Modal>
  );
};
