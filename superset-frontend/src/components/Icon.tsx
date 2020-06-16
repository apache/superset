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
import React, { SVGProps } from 'react';
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
import { ReactComponent as CancelXIcon } from 'images/icons/cancel-x.svg';
import { ReactComponent as SearchIcon } from 'images/icons/search.svg';

interface IconProps extends SVGProps<SVGSVGElement> {
  name:
    | 'checkbox-on'
    | 'checkbox-off'
    | 'checkbox-half'
    | 'sort'
    | 'sort-desc'
    | 'sort-asc'
    | 'trash'
    | 'pencil'
    | 'compass'
    | 'dataset-physical'
    | 'dataset-virtual'
    | 'search'
    | 'cancel-x';
}

const Icon = ({ name, ...rest }: IconProps) => {
  switch (name) {
    case 'checkbox-on':
      return <CheckboxOnIcon {...rest} />;
    case 'checkbox-off':
      return <CheckboxOffIcon {...rest} />;
    case 'checkbox-half':
      return <CheckboxHalfIcon {...rest} />;
    case 'sort':
      return <SortIcon {...rest} />;
    case 'sort-desc':
      return <SortDescIcon {...rest} />;
    case 'sort-asc':
      return <SortAscIcon {...rest} />;
    case 'trash':
      return <TrashIcon {...rest} />;
    case 'pencil':
      return <PencilIcon {...rest} />;
    case 'compass':
      return <CompassIcon {...rest} />;
    case 'dataset-physical':
      return <DatasetPhysicalIcon {...rest} />;
    case 'dataset-virtual':
      return <DatasetVirtualIcon {...rest} />;
    case 'cancel-x':
      return <CancelXIcon {...rest} />;
    case 'search':
      return <SearchIcon {...rest} />;
    default:
      return null;
  }
};

export default styled(Icon)<{}>`
  color: #666666;
`;
