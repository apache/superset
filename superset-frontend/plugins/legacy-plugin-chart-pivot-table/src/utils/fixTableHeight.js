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

/**
 * Fix the height of the table body of a DataTable with scrollY set
 */
export default function fixTableHeight($tableDom, height) {
  const headHeight = $tableDom.find('.dataTables_scrollHead').height();
  const filterHeight = $tableDom.find('.dataTables_filter').height() || 0;
  const pageLengthHeight = $tableDom.find('.dataTables_length').height() || 0;
  const paginationHeight = $tableDom.find('.dataTables_paginate').height() || 0;
  const controlsHeight =
    pageLengthHeight > filterHeight ? pageLengthHeight : filterHeight;
  $tableDom
    .find('.dataTables_scrollBody')
    .css('max-height', height - headHeight - controlsHeight - paginationHeight);
}
