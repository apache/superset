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
import { styled } from '@apache-superset/core/theme';

/**
 * Preformatted error detail for an Alert description: preserves the server
 * error's line breaks, wraps long unbroken tokens (SQL, URIs, payloads)
 * instead of overflowing the Alert, and uses the theme's code font so it
 * matches other preformatted errors in the app.
 */
export const PreformattedErrorDescription = styled.pre`
  margin: 0;
  font-family: ${({ theme }) => theme.fontFamilyCode};
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`;
