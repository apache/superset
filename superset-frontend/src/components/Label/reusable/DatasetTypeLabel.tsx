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
import Icons from 'src/components/Icons';
import Label from 'src/components/Label';
import { t } from '@superset-ui/core';

// Define the prop types for DatasetTypeLabel
interface DatasetTypeLabelProps {
  datasetType: 'physical' | 'virtual'; // Accepts only 'physical' or 'virtual'
}

const SIZE = 's'; // Define the size as a constant

const DatasetTypeLabel: React.FC<DatasetTypeLabelProps> = ({ datasetType }) => {
  const label: string =
    datasetType === 'physical' ? t('Physical') : t('Virtual');
  const icon =
    datasetType === 'physical' ? (
      <Icons.Table iconSize={SIZE} />
    ) : (
      <Icons.ConsoleSqlOutlined iconSize={SIZE} />
    );
  const labelType: 'primary' | 'secondary' =
    datasetType === 'physical' ? 'primary' : 'secondary';

  return (
    <Label icon={icon} type={labelType}>
      {label}
    </Label>
  );
};

export default DatasetTypeLabel;
