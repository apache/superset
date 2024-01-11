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
import DvtDargCard, { DvtDragCardProps, DvtDragCardData } from './index';

export default {
  title: 'Dvt-Components/DvtDargCard',
  component: DvtDargCard,
};

export const Default = (args: DvtDragCardProps) => {
  const cardData: DvtDragCardData[] = [
    {
      label: 'arac',
      value: 'arac',
      icon: 'dvt-hashtag',
    },
    {
      label: 'id',
      value: 'id',
      icon: 'dvt-hashtag',
    },
  ];

  const [droppedData, setDroppedData] = useState<DvtDragCardData[]>([]);

  const handleDrop = (index: number) => {
    const draggedCard = cardData[index];
    setDroppedData([draggedCard]);
  };

  return (
    <div
      style={{
        display: 'flex',
        width: '600px',
      }}
    >
      <DvtDargCard {...args} data={cardData} />
      <div
        style={{
          display: 'flex',
          border: '2px dashed #aaa',
          padding: '10px',
          height: '50px',
          width: '300px',
        }}
        onDragOver={e => e.preventDefault()}
        onDrop={() => handleDrop(0)}
      >
        <div
          onClick={() => setDroppedData([])}
          style={{
            fontWeight: '600',
            fontSize: '15px',
            border: '1 px solid #000',
            paddingRight: '15px',
          }}
        >
          x
        </div>
        {droppedData.map((item, index) => (
          <div key={index}>
            <div>{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
