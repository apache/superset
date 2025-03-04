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

import { styled } from '@superset-ui/core';

const MetadataWrapper = styled.div`
  display: flex;
  width: 100%;
  position: absolute;
  left: 0;
  top: 100%;
  margin-top: ${({ theme }) => theme.gridUnit}px;
`;

const MetadataText = styled.span`
  font-size: ${({ theme }) => theme.typography.sizes.xs}px;
  color: ${({ theme }) => theme.colors.grayscale.light1};
  font-weight: ${({ theme }) => theme.typography.weights.medium};
`;

export type MetadataProps = {
  value: string;
};

const Metadata: React.FC<MetadataProps> = ({ value }) => (
  <MetadataWrapper>
    <MetadataText>{value}</MetadataText>
  </MetadataWrapper>
);

export default Metadata;
