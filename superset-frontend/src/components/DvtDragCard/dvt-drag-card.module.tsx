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
  flex-direction: column;
  width: 100%;
`;

const StyledDvtCardSize = styled.div`
  color: #b8c1cc;
  font-size: 12px;
  font-weight: 500;
  padding-bottom: 6px;
`;

const StyleddvtCardCard = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 202px;
  height: 48px;
  border-radius: 12px;
  background: #f8fafc;
  margin-bottom: 12px;
`;

const StyleddvtCardIcon = styled.div`
  margin-left: 13px;
`;

const StyleddvtCardLabel = styled.div``;

export {
  StyledDvtCard,
  StyledDvtCardSize,
  StyleddvtCardCard,
  StyleddvtCardIcon,
  StyleddvtCardLabel,
};
