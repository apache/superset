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

import moment from 'moment';
import { FilterDropdown } from 'src/views/CRUD/flash/types';

const DATE_FORMATS = {
  UTC: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
};

export const removeUnnecessaryProperties = (
  formObject: Object,
  properties: Array<string>,
) => {
  const formObjLocalRef = formObject;
  Object.keys(formObject).forEach(key => {
    if (properties.includes(key)) {
      delete formObjLocalRef[key];
    }
  });
};

export const convertToLocalDateTime = (date?: Date) => {
  const newDate = date;
  return newDate ? new Date(newDate).toISOString() : new Date().toISOString();
};

export const convertTolllDatetime = (datetime: string) => {
  if (datetime) {
    if (validateDateFormat(datetime)) {
      return moment(new Date(datetime)).format('llll');
    }
    return datetime;
  }

  return null;
};
export const convertTolllDate = (date: string) =>
  date ? moment(new Date(date)).format('ll') : null;

const validateDateFormat = (dateString: string) => {
  const format = DATE_FORMATS.UTC;
  const isValidFormat = moment(dateString, format, true).isValid();
  return isValidFormat;
};

export const convertValueToLabel = (
  id: string,
  dropdown: FilterDropdown[] | null,
) => {
  if (dropdown && dropdown.length > 0) {
    const itemValue = dropdown.find(
      (item: FilterDropdown) => item.value === id,
    );
    if (itemValue && itemValue.label) {
      return itemValue.label;
    }

    return null;
  }

  return null;
};

export const convertDateToReqFormat = (date: string) =>
  moment(date).format('DD/MM/YYYY hh:mm:ss A');
