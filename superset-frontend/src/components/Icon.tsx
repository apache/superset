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
import { ReactComponent as CancelXIcon } from 'images/icons/cancel-x.svg';
import { ReactComponent as CheckIcon } from 'images/icons/check.svg';
import { ReactComponent as CircleCheckIcon } from 'images/icons/circle-check.svg';
import { ReactComponent as CircleCheckSolidIcon } from 'images/icons/circle-check-solid.svg';
import { ReactComponent as CheckboxHalfIcon } from 'images/icons/checkbox-half.svg';
import { ReactComponent as CheckboxOffIcon } from 'images/icons/checkbox-off.svg';
import { ReactComponent as CheckboxOnIcon } from 'images/icons/checkbox-on.svg';
import { ReactComponent as CloseIcon } from 'images/icons/close.svg';
import { ReactComponent as CompassIcon } from 'images/icons/compass.svg';
import { ReactComponent as DatasetPhysicalIcon } from 'images/icons/dataset_physical.svg';
import { ReactComponent as DatasetVirtualIcon } from 'images/icons/dataset_virtual.svg';
import { ReactComponent as ErrorIcon } from 'images/icons/error.svg';
import { ReactComponent as PencilIcon } from 'images/icons/pencil.svg';
import { ReactComponent as SearchIcon } from 'images/icons/search.svg';
import { ReactComponent as SortAscIcon } from 'images/icons/sort-asc.svg';
import { ReactComponent as SortDescIcon } from 'images/icons/sort-desc.svg';
import { ReactComponent as SortIcon } from 'images/icons/sort.svg';
import { ReactComponent as TrashIcon } from 'images/icons/trash.svg';
import { ReactComponent as WarningIcon } from 'images/icons/warning.svg';
import { ReactComponent as ShareIcon } from 'images/icons/share.svg';

type IconName =
  | 'cancel-x'
  | 'check'
  | 'checkbox-half'
  | 'checkbox-off'
  | 'checkbox-on'
  | 'close'
  | 'circle-check'
  | 'circle-check-solid'
  | 'compass'
  | 'dataset-physical'
  | 'dataset-virtual'
  | 'error'
  | 'pencil'
  | 'search'
  | 'sort'
  | 'sort-asc'
  | 'sort-desc'
  | 'trash'
  | 'share'
  | 'warning';

const iconsRegistry: Record<
  IconName,
  React.ComponentType<SVGProps<SVGSVGElement>>
> = {
  'cancel-x': CancelXIcon,
  'checkbox-half': CheckboxHalfIcon,
  'checkbox-off': CheckboxOffIcon,
  'checkbox-on': CheckboxOnIcon,
  'circle-check': CircleCheckIcon,
  'circle-check-solid': CircleCheckSolidIcon,
  'dataset-physical': DatasetPhysicalIcon,
  'dataset-virtual': DatasetVirtualIcon,
  'sort-asc': SortAscIcon,
  'sort-desc': SortDescIcon,
  check: CheckIcon,
  close: CloseIcon,
  compass: CompassIcon,
  error: ErrorIcon,
  pencil: PencilIcon,
  search: SearchIcon,
  sort: SortIcon,
  trash: TrashIcon,
  warning: WarningIcon,
  share: ShareIcon,
};
interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
}

const Icon = ({ name, color = '#666666', ...rest }: IconProps) => {
  const Component = iconsRegistry[name];
  return <Component color={color} data-test={name} {...rest} />;
};

export default Icon;
