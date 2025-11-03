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

const dateFilterComparator = (filterDate: Date, cellValue: Date) => {
  const cellDate = new Date(cellValue);
  cellDate.setHours(0, 0, 0, 0);
  if (Number.isNaN(cellDate?.getTime())) return -1;

  const cellDay = cellDate.getDate();
  const cellMonth = cellDate.getMonth();
  const cellYear = cellDate.getFullYear();

  const filterDay = filterDate.getDate();
  const filterMonth = filterDate.getMonth();
  const filterYear = filterDate.getFullYear();

  if (cellYear < filterYear) return -1;
  if (cellYear > filterYear) return 1;
  if (cellMonth < filterMonth) return -1;
  if (cellMonth > filterMonth) return 1;
  if (cellDay < filterDay) return -1;
  if (cellDay > filterDay) return 1;

  return 0;
};

export default dateFilterComparator;
