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
import { combineReducers } from 'redux';
import shortid from 'shortid';

import { bootstrapData } from 'src/preamble';
import reports from 'src/reports/reducers/reports';
import charts from 'src/components/Chart/chartReducer';
import dataMask from 'src/dataMask/reducer';
import messageToasts from 'src/components/MessageToasts/reducers';
import datasources from './datasourcesReducer';
import saveModal from './saveModalReducer';
import explore from './exploreReducer';

// noopReducer, userReducer temporarily copied from src/views/store.ts
// TODO: when SPA work is done, we'll be able to reuse those instead of copying

const noopReducer =
  initialState =>
  (state = initialState) =>
    state;

const userReducer = (user = bootstrapData.user || {}, action) => {
  if (action.type === 'USER_LOADED') {
    return action.user;
  }
  return user;
};

export default combineReducers({
  charts,
  saveModal,
  dataMask,
  datasources,
  explore,
  messageToasts,
  reports,
  impressionId: noopReducer(shortid.generate()),
  user: userReducer,
  common: noopReducer(bootstrapData.common || {}),
});
