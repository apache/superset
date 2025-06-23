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

import { t } from '@superset-ui/core';
import { Tag } from 'antd';
import React from 'react';
import { MapMaxExtentTagProps } from '../../types';

export const MapMaxExtentTag: React.FC<MapMaxExtentTagProps> = ({
  value,
  className,
}) => {
  const unsetName = t('unset');
  const lowerLeftName = t('Lower left (Lat | Lon)');
  const upperRightName = t('Upper right (Lat | Lon)');

  return (
    <Tag className={className}>
      {upperRightName}:{' '}
      {value.fixedMaxX && value.fixedMaxY
        ? `${value.fixedMaxY.toFixed(6)} | ${value.fixedMaxX.toFixed(6)}`
        : unsetName}
      <br />
      {lowerLeftName}:{' '}
      {value.fixedMinX && value.fixedMinY
        ? `${value.fixedMinY.toFixed(6)} | ${value.fixedMinX.toFixed(6)}`
        : unsetName}
    </Tag>
  );
};

export default MapMaxExtentTag;
