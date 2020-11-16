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

import React, { useState, FunctionComponent} from 'react';
import { Radio, AutoComplete, Input } from 'src/common/components';
import Modal from 'src/common/components/Modal';
import Button from 'src/components/Button';

const mockVal = (str, repeat = 1) => {
  return {
    value: str.repeat(repeat),
  };
};

interface SaveDatasetModalProps = {
}

// eslint-disable-next-line no-empty-pattern
export const SaveDatasetModal: FunctionComponent<> = ({visible, onOk, onCancel, handleDatasetNameChange}) => {
  const [value, setValue] = useState('');
  const [options, setOptions] = useState([]);
  const [radioOption, setRadioOptions] = useState(1);

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

  const onRadioChange = e => {
    console.log('radio checked', e.target.value);
    setRadioOptions(e.target.value)
  };

  const radioStyle = {
    display: 'block',
    height: '30px',
    lineHeight: '30px',
  };

  return (
    <Modal
      show={visible}
      onHide={() => {}}
      title="Save a new dataset"
      onCancel={onCancel}
      footer={<>
          <Button
            buttonSize="sm"
            buttonStyle="primary"
            className="m-r-5"
            onClick={onOk}
          >
            Save & Explore
        </Button>
      </>
    }
    >
      <div>
        <div>
          To explore the results of this query, we need to save it as a virtual dataset
        </div>
        <Radio.Group onChange={onRadioChange} value={radioOption}>
          <Radio style={radioStyle} value={1}>
            Save as new dataset
            <Input style={{ width: 200 }} defaultValue="my_new_dataset_A" onChange={handleDatasetNameChange} />
          </Radio>
          <Radio style={radioStyle} value={2}>
            Overwrite existing dataset
            <AutoComplete
              options={options}
              style={{
                width: 200,
              }}
              onSelect={onSelect}
              onSearch={onSearch}
              placeholder="input here"
            />
          </Radio>
        </Radio.Group>
      </div>
    </Modal>
  );
};
