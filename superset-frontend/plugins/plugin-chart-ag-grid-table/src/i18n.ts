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

import { Locale } from '@superset-ui/core';

const en = {
  'Query Mode': [''],
  Aggregate: [''],
  'Raw Records': [''],
  'Emit Filter Events': [''],
  'Show Cell Bars': [''],
  'page_size.show': ['Show'],
  'page_size.all': ['All'],
  'page_size.entries': ['entries'],
  'table.previous_page': ['Previous'],
  'table.next_page': ['Next'],
  'search.num_records': ['%s record', '%s records...'],
};

const translations: Partial<Record<Locale, typeof en>> = {
  en,
  fr: {
    'Query Mode': [''],
    Aggregate: [''],
    'Raw Records': [''],
    'Emit Filter Events': [''],
    'Show Cell Bars': [''],
    'page_size.show': ['Afficher'],
    'page_size.all': ['tous'],
    'page_size.entries': ['entrées'],
    'table.previous_page': ['Précédent'],
    'table.next_page': ['Suivante'],
    'search.num_records': ['%s enregistrement', '%s enregistrements...'],
  },
  zh: {
    'Query Mode': ['查询模式'],
    Aggregate: ['分组聚合'],
    'Raw Records': ['原始数据'],
    'Emit Filter Events': ['关联看板过滤器'],
    'Show Cell Bars': ['为指标添加条状图背景'],
    'page_size.show': ['每页显示'],
    'page_size.all': ['全部'],
    'page_size.entries': ['条'],
    'table.previous_page': ['上一页'],
    'table.next_page': ['下一页'],
    'search.num_records': ['%s条记录...'],
  },
};

export default translations;
