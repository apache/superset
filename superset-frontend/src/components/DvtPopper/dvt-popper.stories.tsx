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
import DvtButton from '../DvtButton';
import DvtPopper, { DvtPopperProps } from '.';

export default {
  title: 'Dvt-Components/DvtPopper',
  component: DvtPopper,
};

export const Default = (args: DvtPopperProps) => {
  const [isOpen, setIsOpen] = useState<boolean>(true);

  return (
    <div
      style={{
        width: '100px',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <DvtButton label="Open/Close" onClick={() => setIsOpen(!isOpen)} />
      <DvtPopper
        {...args}
        onClick={() => {}}
        isOpen={isOpen}
        setIsOpen={setIsOpen}
      />
    </div>
  );
};

Default.args = {
  label: 'Export',
};
