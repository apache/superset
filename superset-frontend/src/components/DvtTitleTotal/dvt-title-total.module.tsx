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

const StyledDvtTitleTotal = styled.div`
  gap: 5px;
  display: flex;
  align-items: center;
`;

const DvtTitle = styled.p`
  color: ${({ theme }) => theme.colors.dvt.text.bold};
  font-size: 16px;
  font-style: normal;
  font-weight: 700;
  letter-spacing: 0.2px;
  margin: 0;
`;

const DvtTotal = styled.p`
  color: ${({ theme }) => theme.colors.dvt.text.label};
  font-size: 16px;
  font-style: normal;
  font-weight: 400;
  margin: 0;
`;

export { StyledDvtTitleTotal, DvtTotal, DvtTitle };
