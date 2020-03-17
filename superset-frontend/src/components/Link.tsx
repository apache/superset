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
import React, { ReactNode } from 'react';
// @ts-ignore
import { OverlayTrigger, Tooltip } from 'react-bootstrap';

interface Props {
  children?: ReactNode;
  className?: string;
  href?: string;
  onClick?: () => void;
  placement?: string;
  style?: object;
  tooltip?: string | null;
}

const Link = ({
  children = null,
  className = '',
  href = '#',
  onClick = () => undefined,
  placement = 'top',
  style = {},
  tooltip = null,
}: Props) => {
  const link = (
    <a
      href={href}
      onClick={onClick}
      style={style}
      className={'Link ' + className}
    >
      {children}
    </a>
  );
  if (tooltip) {
    return (
      <OverlayTrigger
        overlay={<Tooltip id="tooltip">{tooltip}</Tooltip>}
        placement={placement}
        delayShow={300}
        delayHide={150}
      >
        {link}
      </OverlayTrigger>
    );
  }
  return link;
};

export default Link;
