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

const StyledDvtCard = styled.div`
  display: flex;
  width: 100%;
`;

const StyledDvtCardCard = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 202px;
  height: 48px;
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.dvt.grayscale.light2};
  margin-bottom: 12px;
`;

const StyledDvtCardIcon = styled.div`
  display: flex;
  align-items: center;
  margin-left: 13px;
`;

const StyledDvtCardLabel = styled.div`
  display: flex;
  align-items: center;
`;

export {
  StyledDvtCard,
  StyledDvtCardCard,
  StyledDvtCardIcon,
  StyledDvtCardLabel,
};
