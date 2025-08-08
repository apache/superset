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
import { Icons } from '@superset-ui/core/components/Icons';
import { t, useTheme } from '@superset-ui/core';
import { Label } from '..';

// Define the prop types for DatasetTypeLabel
interface DatasetTypeLabelProps {
  datasetType: 'physical' | 'virtual'; // Accepts only 'physical' or 'virtual'
}

const SIZE = 's'; // Define the size as a constant

export const DatasetTypeLabel: React.FC<DatasetTypeLabelProps> = ({
  datasetType,
}) => {
  const theme = useTheme();
  const label: string =
    datasetType === 'physical' ? t('Physical') : t('Virtual');
  const icon =
    datasetType === 'physical' ? (
      <Icons.InsertRowAboveOutlined
        iconSize={SIZE}
        iconColor={theme.colorPrimary}
      />
    ) : (
      <Icons.ConsoleSqlOutlined iconSize={SIZE} />
    );
  const labelType = datasetType === 'physical' ? 'primary' : 'default';

  return (
    <Label
      icon={icon}
      type={labelType}
      style={{
        color:
          datasetType === 'physical'
            ? theme.colorPrimaryText
            : theme.colorPrimary,
      }}
    >
      {label}
    </Label>
  );
};
