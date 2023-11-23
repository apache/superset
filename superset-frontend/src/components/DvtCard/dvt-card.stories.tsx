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
import { supersetTheme } from '@superset-ui/core';
import DvtCard, { DvtCardProps } from '.';

export default {
  title: 'Dvt-Components/DvtCard',
  component: DvtCard,
  argTypes: {
    isFavorite: { control: 'boolean' },
  },
};

export const Default = (args: DvtCardProps) => {
  const [isFavorite, setIsFavorite] = useState<boolean>(false);

  return (
    <div
      style={{
        padding: 20,
        backgroundColor: supersetTheme.colors.dvt.grayscale.light2,
        height: '88vh',
      }}
    >
      <DvtCard {...args} isFavorite={isFavorite} setFavorite={setIsFavorite} />
    </div>
  );
};

Default.args = {
  title: 'card title',
  label: 'Label',
  description:
    'Monitors real-time network stats like latency and uptime for smooth operations.',
};
