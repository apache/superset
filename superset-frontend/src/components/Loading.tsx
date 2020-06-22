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

interface Props {
  position: string;
  className: string;
}

const FLOATING_STYLE = {
  padding: 0,
  margin: 0,
  position: 'absolute',
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
};

const LoaderImg = styled.img`
  z-index: 1000;
  &.margin-zero {
    margin: 0px;
  }
`;
export default function Loading({
  position = 'floating',
  className = '',
}: Props) {
  const style = position === 'floating' ? FLOATING_STYLE : {};
  return (
    <LoaderImg
      className={`loading ${className}`}
      alt="Loading..."
      src="/static/assets/images/loading.gif"
      style={style}
    />
  );
}
