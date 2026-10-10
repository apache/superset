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
import { useDispatch } from 'react-redux';
import type { AppDispatch } from 'src/views/store';

// In Module Federation deployments where the host shell shares src/views/store
// as a singleton, a version skew between the shell and the SQL Lab chunk can
// leave useAppDispatch undefined at runtime even though TypeScript types it as
// always-present. Keep this hook free of runtime imports from src/views/store:
// store initialization imports SqlLab persistence helpers, so importing store
// values here can create an app-startup circular dependency.
export const useAppDispatch: () => AppDispatch = useDispatch;
