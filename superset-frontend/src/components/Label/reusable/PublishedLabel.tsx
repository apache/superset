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

// Define props for the PublishedLabel component
interface PublishedLabelProps {
  isPublished: boolean; // Whether the item is published
  onClick?: () => void; // Optional click handler
}

const PublishedLabel: React.FC<PublishedLabelProps> = ({
  isPublished,
  onClick,
}) => {
  const label = isPublished ? t('Published') : t('Draft');
  const icon = isPublished ? (
    <Icons.CircleCheck iconSize="s" />
  ) : (
    <Icons.Minus iconSize="s" />
  );
  const labelType = isPublished ? 'primary' : 'secondary';

  return (
    <Label type={labelType} icon={icon} onClick={onClick}>
      {label}
    </Label>
  );
};

export default PublishedLabel;
