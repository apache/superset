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

type Icon =
  | 'cancel-x'
  | 'checkbox-half'
  | 'checkbox-off'
  | 'checkbox-on'
  | 'compass'
  | 'dataset-physical'
  | 'dataset-virtual'
  | 'pencil'
  | 'search'
  | 'sort-asc'
  | 'sort-desc'
  | 'sort'
  | 'trash';

const iconsRegistry: { [key in Icon]: React.ComponentType } = {
  'cancel-x': CancelXIcon,
  'checkbox-half': CheckboxHalfIcon,
  'checkbox-off': CheckboxOffIcon,
  'checkbox-on': CheckboxOnIcon,
  compass: CompassIcon,
  'dataset-physical': DatasetPhysicalIcon,
  'dataset-virtual': DatasetVirtualIcon,
  pencil: PencilIcon,
  search: SearchIcon,
  'sort-asc': SortAscIcon,
  'sort-desc': SortDescIcon,
  sort: SortIcon,
  trash: TrashIcon,
};
interface IconProps extends SVGProps<SVGSVGElement> {
  name: Icon;
}

const Icon = ({ name, ...rest }: IconProps) => {
  const Component = iconsRegistry[name];
  return <Component {...rest} />;
};

export default styled(Icon)<{}>`
  color: #666666;
`;
