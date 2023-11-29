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
import DvtButton from '../DvtButton';
import {
  StyledDvtTextarea,
  StyledDvtTextareaSelectRun,
  StyledDvtTextareaLimit,
  StyledDvtTextareaLimitInput,
  StyledDvtTextareaButton,
} from './dvt-textarea-select-run.module';

export interface DvtTextareaSelectRunProps {
  limit: number;
  setLimit: (newLimit: number) => void;
  clickRun: () => void;
  disabled?: boolean;
  placeholder?: string;
  value: string;
  setValue: (newValue: string) => void;
}

const DvtTextareaSelectRun: React.FC<DvtTextareaSelectRunProps> = ({
  limit,
  setLimit,
  clickRun,
  disabled = false,
  placeholder,
  value,
  setValue,
}) => {
  const handleLimit = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newLimit = parseInt(event.target.value, 10);
    setLimit(newLimit);
    if (value.length > newLimit) {
      setValue(value.slice(0, newLimit));
    }
  };
  return (
    <StyledDvtTextareaSelectRun>
      <StyledDvtTextarea
        maxLength={limit}
        placeholder={placeholder}
        value={value}
        onChange={event => setValue(event.target.value)}
      />
      <StyledDvtTextareaLimit>
        LIMIT:
        <StyledDvtTextareaLimitInput
          defaultValue={limit}
          onBlur={handleLimit}
          disabled={disabled}
          maxLength={4}
        />
        <StyledDvtTextareaButton>
          <DvtButton label="Run" onClick={clickRun} maxWidth />
        </StyledDvtTextareaButton>
      </StyledDvtTextareaLimit>
    </StyledDvtTextareaSelectRun>
  );
};

export default DvtTextareaSelectRun;
