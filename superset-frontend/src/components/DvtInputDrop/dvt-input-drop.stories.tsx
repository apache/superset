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
import DvtInputDrop, { DvtInputDropProps } from './index';
import DvtDargCard from '../DvtDragCard';

export default {
  title: 'Dvt-Components/DvtInputDrop',
  component: DvtInputDrop,
};

export const Default = (args: DvtInputDropProps) => {
  const [droppedData, setDroppedData] = useState<any[] | null>(null);

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', width: 404, gap: 20 }}
    >
      <DvtInputDrop
        {...args}
        droppedData={droppedData}
        setDroppedData={setDroppedData}
      />
      <DvtDargCard
        label="arac"
        value={{ id: 1, name: 'arac' }}
        icon="dvt-hashtag"
      />
      <DvtDargCard
        label="arac2"
        value={{ id: 2, name: 'arac2' }}
        icon="dvt-hashtag"
      />
    </div>
  );
};
Default.args = {
  placeholder: 'Drop columns here or click',
  label: 'Metrics',
  popoverLabel: 'Info',
};
