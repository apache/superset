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

import createMultiFormatter from '../factories/createMultiFormatter';

const smartDateFormatter = createMultiFormatter({
  id: 'smart_date_verbose',
  label: 'Verbose Adaptative Formatting',
  formats: {
    millisecond: '.%L',
    second: '%a %b %d, %I:%M:%S %p',
    minute: '%a %b %d, %I:%M %p',
    hour: '%a %b %d, %I %p',
    day: '%a %b %-e',
    week: '%a %b %-e',
    month: '%b %Y',
    year: '%Y',
  },
});

export default smartDateFormatter;
