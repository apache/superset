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
import styled from '@superset-ui/style';
// @ts-ignore
import Select, { Async } from 'react-select';

export default styled(Select)`
  display: inline;
  &.is-focused:not(.is-open) > .Select-control {
    border: none;
    box-shadow: none;
  }
  .Select-control {
    display: inline-table;
    border: none;
    width: 100px;
    &:focus,
    &:hover {
      border: none;
      box-shadow: none;
    }

    .Select-arrow-zone {
      padding-left: 10px;
    }
  }
  .Select-menu-outer {
    margin-top: 0;
    border-bottom-left-radius: 0;
    border-bottom-left-radius: 0;
  }
`;

export const AsyncStyledSelect = styled(Async)`
  display: inline;
  &.is-focused:not(.is-open) > .Select-control {
    border: none;
    box-shadow: none;
  }
  .Select-control {
    display: inline-table;
    border: none;
    width: 100px;
    &:focus,
    &:hover {
      border: none;
      box-shadow: none;
    }

    .Select-arrow-zone {
      padding-left: 10px;
    }
  }
  .Select-menu-outer {
    margin-top: 0;
    border-bottom-left-radius: 0;
    border-bottom-left-radius: 0;
  }
`;
