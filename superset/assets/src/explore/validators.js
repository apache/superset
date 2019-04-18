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
/* Reusable validator functions used in controls definitions
 *
 * validator functions receive the v and the configuration of the control
 * as arguments and return something that evals to false if v is valid,
 * and an error message if not valid.
 * */
import { t } from '@superset-ui/translation';
import validate from 'validate.js';

// Declare formatting
validate.formatters.joined = errors => errors.map(error =>  error.validator).join(', ');

export function numeric(v) {
  return validate.single(v, {
    presence: true,
    numericality: {
      message: t('is expected to be a number'),
    },
  }, { format: 'joined' }) || false;
}

export function integer(v) {
  return validate.single(v, {
    presence: true,
    numericality: {
      onlyInteger: true,
      message: t('is expected to be an integer'),
    },
  }, { format: 'joined' }) || false;
}

export function nonEmpty(v) {
  return validate.single(v, {
    presence: {
      allowEmpty: false,
      message: t('cannot be empty'),
    },
  }, { format: 'joined' }) || false;
}
