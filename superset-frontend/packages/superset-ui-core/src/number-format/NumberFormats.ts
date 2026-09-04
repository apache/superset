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

const DOLLAR = '$,.2f';
const DOLLAR_SIGNED = '+$,.2f';
const DOLLAR_ROUND = '$,d';
const DOLLAR_ROUND_SIGNED = '+$,d';

const FLOAT_1_POINT = ',.1f';
const FLOAT_2_POINT = ',.2f';
const FLOAT_3_POINT = ',.3f';
const FLOAT = FLOAT_2_POINT;

const FLOAT_SIGNED_1_POINT = '+,.1f';
const FLOAT_SIGNED_2_POINT = '+,.2f';
const FLOAT_SIGNED_3_POINT = '+,.3f';
const FLOAT_SIGNED = FLOAT_SIGNED_2_POINT;

const INTEGER = ',d';
const INTEGER_SIGNED = '+,d';

const PERCENT = ',.0%';
const PERCENT_1_POINT = ',.1%';
const PERCENT_2_POINT = ',.2%';
const PERCENT_3_POINT = ',.3%';

const PERCENT_SIGNED = '+,.0%';
const PERCENT_SIGNED_1_POINT = '+,.1%';
const PERCENT_SIGNED_2_POINT = '+,.2%';
const PERCENT_SIGNED_3_POINT = '+,.3%';

const SI = '.0s';
const SI_1_DIGIT = '.1s';
const SI_2_DIGIT = '.2s';
const SI_3_DIGIT = '.3s';

const SMART_NUMBER = 'SMART_NUMBER';
const SMART_NUMBER_SIGNED = 'SMART_NUMBER_SIGNED';
const OVER_MAX_HIDDEN = 'OVER_MAX_HIDDEN';

const NumberFormats = {
  DOLLAR,
  DOLLAR_ROUND,
  DOLLAR_ROUND_SIGNED,
  DOLLAR_SIGNED,
  FLOAT,
  FLOAT_1_POINT,
  FLOAT_2_POINT,
  FLOAT_3_POINT,
  FLOAT_SIGNED,
  FLOAT_SIGNED_1_POINT,
  FLOAT_SIGNED_2_POINT,
  FLOAT_SIGNED_3_POINT,
  INTEGER,
  INTEGER_SIGNED,
  PERCENT,
  PERCENT_1_POINT,
  PERCENT_2_POINT,
  PERCENT_3_POINT,
  PERCENT_SIGNED,
  PERCENT_SIGNED_1_POINT,
  PERCENT_SIGNED_2_POINT,
  PERCENT_SIGNED_3_POINT,
  SI,
  SI_1_DIGIT,
  SI_2_DIGIT,
  SI_3_DIGIT,
  SMART_NUMBER,
  SMART_NUMBER_SIGNED,
  OVER_MAX_HIDDEN,
};

export default NumberFormats;
