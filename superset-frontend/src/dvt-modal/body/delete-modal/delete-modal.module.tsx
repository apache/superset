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

const StyledDeleteModal = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  gap: 15px;
`;

const StyledDeleteModalHeader = styled.div`
  display: flex;
  align-items: center;
  border-radius: 12px;
  background-color: ${({ theme }) => theme.colors.dvt.grayscale.light2};
  margin: 20px 27px 3px 27px;
  height: 60px;
  padding-left: 16px;
  font-weight: 600;
`;

const StyledDeleteModalBody = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background-color: ${({ theme }) => theme.colors.dvt.grayscale.light2};
  margin: 0px 27px 16px 27px;
  border-radius: 12px;
  height: 100%;
  padding: 18px 28px;
  gap: 15px;
`;

const StyledDeleteModalLabel = styled.div``;
const StyledDeleteModalButton = styled.div`
  display: flex;
  justify-content: end;
  gap: 25px;
`;

export {
  StyledDeleteModal,
  StyledDeleteModalHeader,
  StyledDeleteModalBody,
  StyledDeleteModalLabel,
  StyledDeleteModalButton,
};
