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
  CHART_ADD_PAGE,
  DASHBOARD_LIST_PAGE,
  EXPLORE_PAGE,
  SUPERSET_DASHBOARD_PAGE,
  WELCOME_PAGE,
} from './constants';

export default function getCurrentPageFromLocation(pathname: string) {
  if (pathname.includes(WELCOME_PAGE)) {
    return WELCOME_PAGE;
  } else if (pathname.includes(DASHBOARD_LIST_PAGE)) {
    return DASHBOARD_LIST_PAGE;
  } else if (pathname.includes(SUPERSET_DASHBOARD_PAGE)) {
    return SUPERSET_DASHBOARD_PAGE;
  } else if (pathname.includes(CHART_ADD_PAGE)) {
    return CHART_ADD_PAGE;
  } else if (pathname.includes(EXPLORE_PAGE)) {
    return EXPLORE_PAGE;
  }

  return undefined;
}
