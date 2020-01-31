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
import {
    Pagination as RB_Pagination,
    // @ts-ignore
  } from 'react-bootstrap';
import styled, { withTheme } from 'styled-components';

const Pagination = styled(RB_Pagination)`
li {
  a {
    height: ${(props) => props.theme.colors.secondary.light2};
    min-width: 24px;
    line-height: 24px /2;
    padding: 0;
  }
  &.active a {
    border: 2px solid ${(props) => props.theme.colors.secondary.light2};
    border-radius: ${(props) => props.theme.borderRadius};
  }
}
`;

export default withTheme(Pagination);
