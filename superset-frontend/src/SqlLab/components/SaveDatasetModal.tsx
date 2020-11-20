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
import { SupersetClient } from '@superset-ui/core';

interface SaveDatasetModalProps = {
}

// eslint-disable-next-line no-empty-pattern
export const SaveDatasetModal: FunctionComponent<> = ({visible, onOk, onCancel, handleDatasetNameChange, userDatasetsOwned, handleSaveDatasetRadioBtnState, saveDatasetRadioBtnState, overwriteDataSet, handleOverwriteCancel, handleOverwriteDataset, handleOverwriteDatasetOption, defaultCreateDatasetValue}) => {
  const [options, setOptions] = useState([]);
  const [radioOption, setRadioOptions] = useState(1);

  const onSearch = (searchText) => {
    console.log(userDatasetsOwned)
    setOptions(
      !searchText ? [] : userDatasetsOwned.map(d => ({value: d.dataSetName, dataSetId: d.dataSetId})),
    );
  };

  const filterAutocompleteOption = (inputValue, option) => {
    return option.value.includes(inputValue)
  }

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
      footer={
      <>
       {!overwriteDataSet &&
          <Button
            buttonSize="sm"
            buttonStyle="primary"
            className="m-r-5"
            onClick={onOk}
          >
            Save & Explore
          </Button>
        }
        {overwriteDataSet && <> <Button
            buttonSize="sm"
            buttonStyle="danger"
            className="m-r-5"
            onClick={() => {
              handleOverwriteCancel()
            }}
          >Cancel</Button>
          <Button
            buttonSize="sm"
            buttonStyle="primary"
            className="m-r-5"
            onClick={handleOverwriteDataset}
          >Ok</Button> </>}
      </>
    }
    >
      {!overwriteDataSet && <div>
        <div>
          To explore the results of this query, we need to save it as a virtual dataset
        </div>
        <Radio.Group onChange={handleSaveDatasetRadioBtnState} value={saveDatasetRadioBtnState}>
          <Radio style={radioStyle} value={1}>
            Save as new dataset
            <Input style={{ width: 200 }} defaultValue={defaultCreateDatasetValue} onChange={handleDatasetNameChange} />
          </Radio>
          <Radio style={radioStyle} value={2}>
            Overwrite existing dataset
            <AutoComplete
              options={options}
              style={{
                width: 200,
              }}
              onSelect={handleOverwriteDatasetOption}
              onSearch={onSearch}
              placeholder="input here"
              filterOption={filterAutocompleteOption}
            />
          </Radio>
        </Radio.Group>
        </div>
      }
      {overwriteDataSet &&
        <div>
          Are you sure you want to overwrite this dataset?
        </div>
      }
    </Modal>
  );
};
