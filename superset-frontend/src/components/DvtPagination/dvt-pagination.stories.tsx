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
import React, { useState } from 'react';
import DvtPagination, { DvtPaginationProps } from '.';

export default {
  title: 'Dvt-Components/DvtPagination',
  component: DvtPagination,
};

export const Default = (args: DvtPaginationProps) => {
  const [currentPage, setCurrentPage] = useState(args.page || 1);

  return (
    <DvtPagination
      {...args}
      page={currentPage}
      setPage={setCurrentPage}
      itemSize={args.itemSize}
      pageItemSize={args.pageItemSize}
    />
  );
};

Default.argTypes = {
  page: {
    control: { type: 'number' },
    defaultValue: 3,
  },
  itemSize: {
    control: { type: 'number' },
    defaultValue: 50,
  },
  pageItemSize: {
    control: { type: 'number' },
    defaultValue: 10,
  },
};
