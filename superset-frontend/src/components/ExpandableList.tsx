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
// @ts-ignore
import { Button } from 'react-bootstrap';
import { css } from '@emotion/core';

interface Props {
  items: string[] | React.ElementType[];
  display?: number;
}

function intersperse(arr: any[], sep: string | React.ElementType) {
  if (arr.length === 0) {
    return [];
  }

  return arr.slice(1).reduce((xs, x) => xs.concat([sep, x]), [arr[0]]);
}

const ActionButton: React.FunctionComponent<{ onClick: () => void }> = ({
  onClick,
  children,
}) => (
  <Button
    bsStyle="link"
    css={css`
      padding: 0;
    `}
    onClick={onClick}
  >
    {children}
  </Button>
);

export default function ExpandableList({ items, display = 3 }: Props) {
  const [showingAll, setShowingAll] = useState(false);
  const toggleShowingAll = () => setShowingAll(!showingAll);
  const itemsToDisplay = items.slice(0, display);
  const showMoreAction = items.length > display;

  const lessAction = (
    <ActionButton onClick={toggleShowingAll}>less</ActionButton>
  );
  const moreAction = (
    <ActionButton onClick={toggleShowingAll}>
      {items.length - itemsToDisplay.length} more
    </ActionButton>
  );
  return (
    <span>
      {showingAll
        ? intersperse(items, ', ')
        : intersperse(itemsToDisplay, ', ')}
      {showMoreAction && ', '}
      {showMoreAction && (showingAll ? lessAction : moreAction)}
    </span>
  );
}
