/*
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

export const LOCAL_PREFIX = 'local!';

const DATABASE_DATETIME = '%Y-%m-%d %H:%M:%S';
const DATABASE_DATETIME_REVERSE = '%d-%m-%Y %H:%M:%S';
const US_DATE = '%m/%d/%Y';
const INTERNATIONAL_DATE = '%d/%m/%Y';
const DATABASE_DATE = '%Y-%m-%d';
const TIME = '%H:%M:%S';

const TimeFormats = {
  DATABASE_DATE,
  DATABASE_DATETIME,
  DATABASE_DATETIME_REVERSE,
  INTERNATIONAL_DATE,
  TIME,
  US_DATE,
};

export default TimeFormats;
