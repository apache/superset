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
import styled from '@superset-ui/style';
import { ReactComponent as CheckboxOnIcon } from 'images/icons/checkbox-on.svg';
import { ReactComponent as CheckboxOffIcon } from 'images/icons/checkbox-off.svg';
import { ReactComponent as CheckboxHalfIcon } from 'images/icons/checkbox-half.svg';
import { ReactComponent as SortIcon } from 'images/icons/sort.svg';
import { ReactComponent as SortDescIcon } from 'images/icons/sort-desc.svg';
import { ReactComponent as SortAscIcon } from 'images/icons/sort-asc.svg';
import { ReactComponent as TrashIcon } from 'images/icons/trash.svg';
import { ReactComponent as PencilIcon } from 'images/icons/pencil.svg';
import { ReactComponent as CompassIcon } from 'images/icons/compass.svg';
import { ReactComponent as DatasetPhysicalIcon } from 'images/icons/dataset_physical.svg';
import { ReactComponent as DatasetVirtualIcon } from 'images/icons/dataset_virtual.svg';


interface IconProps {
  name: 'checkbox-on' | 'checkbox-off' | 'checkbox-half' | 'sort' | 'sort-desc' | 'sort-asc' | 'trash' | 'pencil' | 'compass' | 'dataset-physical' | 'dataset-virtual';
}

const Icon = ({ name }: IconProps) => {
  switch (name) {
    case 'checkbox-on':
      return <CheckboxOnIcon />;
    case 'checkbox-off':
      return <CheckboxOffIcon />;
    case 'checkbox-half':
      return <CheckboxHalfIcon />;
    case 'sort':
      return <SortIcon />;
    case 'sort-desc':
      return <SortDescIcon />;
    case 'sort-asc':
      return <SortAscIcon />;
    case 'trash':
      return <TrashIcon />;
    case 'pencil':
      return <PencilIcon />;
    case 'compass':
      return <CompassIcon />;
    case 'dataset-physical':
      return <div>
        <DatasetPhysicalIcon />
      </div>;
    case 'dataset-virtual':
      return <div>
        <DatasetVirtualIcon />
      </div>
    default:
      return null;
  }
}

export default styled(Icon)`
`;