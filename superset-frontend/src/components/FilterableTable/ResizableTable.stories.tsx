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
import React from 'react';
import ResizableTable, {
  ResizableTableProps,
  EmptyWrapperType,
} from './ResizableTable';

export default {
  title: 'ResizableTable',
  component: ResizableTable,
};

export const InteractiveResizableTable = (args: ResizableTableProps) => (
  <>
    <ResizableTable {...args} />
       <select name='Display Data' id='data'>
           <option value='defaultData'>ID, Name, & Age</option>
           <option></option>
           <option></option>
          </select>
 </>
);

InteractiveResizableTable.args = {
  columns: [
    {
      accessor: '_id',
      Header: 'ID',
      sortable: true,
    },
                   
      {
          accessor: 'index',
          Header: 'Index',
      },

      {
          accessor: 'guid',
          Header: 'Guid',
      },

      {
          accessor: 'isActive',
          Header: 'Is Active',
      },

      {
          accessor: 'balance',
          Header: 'Balance',
      },

      {
          accessor: 'picture',
          Header: 'Picture',
      },

      {
          accessor: 'age',
          Header: 'Age',
      },

      {
          accessor: 'eyeColor',
          Header: 'Eye Color',
      },

      {
          accessor: 'name',
          Header: 'Name',
      },

      {
          accessor: 'gender',
          Header: 'Gender',
      },

      {
          accessor: 'company',
          Header: 'Company',
      },

      {
          accessor: 'email',
          Header: 'Email',
      },

      {
          accessor: 'phone',
          Header: 'Phone',
      },

      {
          accessor: 'address',
          Header: 'Address',
      },

      {
          accessor: 'about',
          Header: 'About',
      },
    {
      accessor: 'registered',
      Header: 'Registered',
    },
{
      accessor: 'latitude',
      Header: 'Latitude',
    },
    {
      accessor: 'longitude',
      Header: 'Longitude',
    },
  ],
  data: [
    {
    "_id": "61b3cf11a088a65998a51ad3",
    "index": 0,
    "guid": "77a8771a-d7ee-40cc-9c94-c762ba87d44f",
    "isActive": true,
    "balance": "$2,158.64",
    "picture": "http://placehold.it/32x32",
    "age": 28,
    "eyeColor": "blue",
    "name": "Scott Cantrell",
    "gender": "male",
    "company": "IZZBY",
    "email": "scottcantrell@izzby.com",
    "phone": "+1 (903) 513-3390",
    "address": "480 Lake Avenue, Gulf, Rhode Island, 3364",
    "about": "Irure esse veniam aliquip ea reprehenderit commodo eiusmod occaecat dolore esse est. Magna sit anim commodo occaecat eu nostrud sunt incididunt elit cupidatat adipisicing non nisi. Culpa proident magna pariatur amet culpa culpa id mollit. Quis incididunt et culpa laborum esse dolor laboris pariatur tempor do duis anim non adipisicing.\r\n",
    "registered": "2016-01-28T01:06:59 +08:00",
    "latitude": -11.980193,
    "longitude": 64.071912
  },
{
    "_id": "61b3cf11a088a65998a51ad3",
    "index": 0,
    "guid": "77a8771a-d7ee-40cc-9c94-c762ba87d44f",
    "isActive": true,
    "balance": "$2,158.64",
    "picture": "http://placehold.it/32x32",
    "age": 28,
    "eyeColor": "blue",
    "name": "Scott Cantrell",
    "gender": "male",
    "company": "IZZBY",
    "email": "scottcantrell@izzby.com",
    "phone": "+1 (903) 513-3390",
    "address": "480 Lake Avenue, Gulf, Rhode Island, 3364",
    "about": "Irure esse veniam aliquip ea reprehenderit commodo eiusmod occaecat dolore esse est. Magna sit anim commodo occaecat eu nostrud sunt incididunt elit cupidatat adipisicing non nisi. Culpa proident magna pariatur amet culpa culpa id mollit. Quis incididunt et culpa laborum esse dolor laboris pariatur tempor do duis anim non adipisicing.\r\n",
    "registered": "2016-01-28T01:06:59 +08:00",
    "latitude": -11.980193,
    "longitude": 64.071912
  },
{
    "_id": "61b3cf11a088a65998a51ad3",
    "index": 0,
    "guid": "77a8771a-d7ee-40cc-9c94-c762ba87d44f",
    "isActive": true,
    "balance": "$2,158.64",
    "picture": "http://placehold.it/32x32",
    "age": 28,
    "eyeColor": "blue",
    "name": "Scott Cantrell",
    "gender": "male",
    "company": "IZZBY",
    "email": "scottcantrell@izzby.com",
    "phone": "+1 (903) 513-3390",
    "address": "480 Lake Avenue, Gulf, Rhode Island, 3364",
    "about": "Irure esse veniam aliquip ea reprehenderit commodo eiusmod occaecat dolore esse est. Magna sit anim commodo occaecat eu nostrud sunt incididunt elit cupidatat adipisicing non nisi. Culpa proident magna pariatur amet culpa culpa id mollit. Quis incididunt et culpa laborum esse dolor laboris pariatur tempor do duis anim non adipisicing.\r\n",
    "registered": "2016-01-28T01:06:59 +08:00",
    "latitude": -11.980193,
    "longitude": 64.071912
  },
{
    "_id": "61b3cf11a088a65998a51ad3",
    "index": 0,
    "guid": "77a8771a-d7ee-40cc-9c94-c762ba87d44f",
    "isActive": true,
    "balance": "$2,158.64",
    "picture": "http://placehold.it/32x32",
    "age": 28,
    "eyeColor": "blue",
    "name": "Scott Cantrell",
    "gender": "male",
    "company": "IZZBY",
    "email": "scottcantrell@izzby.com",
    "phone": "+1 (903) 513-3390",
    "address": "480 Lake Avenue, Gulf, Rhode Island, 3364",
    "about": "Irure esse veniam aliquip ea reprehenderit commodo eiusmod occaecat dolore esse est. Magna sit anim commodo occaecat eu nostrud sunt incididunt elit cupidatat adipisicing non nisi. Culpa proident magna pariatur amet culpa culpa id mollit. Quis incididunt et culpa laborum esse dolor laboris pariatur tempor do duis anim non adipisicing.\r\n",
    "registered": "2016-01-28T01:06:59 +08:00",
    "latitude": -11.980193,
    "longitude": 64.071912
  },
  {
    "_id": "61b3cf11cda68a359d28081d",
    "index": 1,
    "guid": "0c12713e-e5e1-4d03-9611-650da5a41da4",
    "isActive": true,
    "balance": "$1,266.14",
    "picture": "http://placehold.it/32x32",
    "age": 38,
    "eyeColor": "green",
    "name": "Paula Gilbert",
    "gender": "female",
    "company": "SLUMBERIA",
    "email": "paulagilbert@slumberia.com",
    "phone": "+1 (842) 568-3436",
    "address": "193 Fiske Place, Orin, Wisconsin, 6080",
    "about": "Aliqua exercitation amet anim irure elit ullamco est adipisicing anim eu velit. Duis irure sit mollit magna dolore. Nostrud amet tempor commodo aute tempor dolor duis anim adipisicing sit est. Nostrud excepteur officia duis sunt ut et duis. Commodo voluptate enim est sint ex. Quis ut ullamco duis qui cupidatat cillum est.\r\n",
    "registered": "2014-02-11T06:40:50 +08:00",
    "latitude": 67.749747,
    "longitude": 23.706625
  },
  {
    "_id": "61b3cf11b8d845b1e70b9341",
    "index": 2,
    "guid": "4671ce68-5d38-4b3f-a9b7-e88665505b52",
    "isActive": false,
    "balance": "$1,970.27",
    "picture": "http://placehold.it/32x32",
    "age": 24,
    "eyeColor": "brown",
    "name": "Penelope Gordon",
    "gender": "female",
    "company": "BUZZOPIA",
    "email": "penelopegordon@buzzopia.com",
    "phone": "+1 (928) 522-3453",
    "address": "966 Bogart Street, Tuttle, Louisiana, 1371",
    "about": "Elit ea proident est aliquip adipisicing commodo proident minim ut aute proident laborum. Est laboris Lorem non ipsum commodo reprehenderit reprehenderit laborum. Deserunt minim fugiat velit nostrud id ipsum. Mollit quis aliqua nisi aliqua anim. Non nulla deserunt elit quis aliqua consectetur irure veniam incididunt ipsum.\r\n",
    "registered": "2019-09-07T06:55:38 +07:00",
    "latitude": 64.368999,
    "longitude": 13.754936
  },
  {
    "_id": "61b3cf116a2590406a734b75",
    "index": 3,
    "guid": "981a3a7d-79df-4c64-968b-a5197f4c783d",
    "isActive": false,
    "balance": "$1,070.57",
    "picture": "http://placehold.it/32x32",
    "age": 37,
    "eyeColor": "blue",
    "name": "Leanna Frank",
    "gender": "female",
    "company": "BIOHAB",
    "email": "leannafrank@biohab.com",
    "phone": "+1 (809) 462-2348",
    "address": "261 Metrotech Courtr, Fairlee, Idaho, 481",
    "about": "Officia esse occaecat tempor excepteur eiusmod consequat aliqua dolore nostrud non anim est eiusmod. Laboris voluptate ullamco cillum qui ut ex laborum velit irure sint esse. Esse non non deserunt dolore. Occaecat eu sit id id exercitation ipsum. Ea ex amet voluptate non consequat commodo cupidatat nisi magna eiusmod. Consequat Lorem sint tempor in.\r\n",
    "registered": "2021-06-11T02:50:43 +07:00",
    "latitude": 22.327039,
    "longitude": -99.142233
  },
  {
    "_id": "61b3cf1127d71fa77914b0f0",
    "index": 4,
    "guid": "0b7f2da6-bf24-468b-9458-2447f0ed2ea5",
    "isActive": false,
    "balance": "$3,833.53",
    "picture": "http://placehold.it/32x32",
    "age": 26,
    "eyeColor": "blue",
    "name": "Wolfe Fowler",
    "gender": "male",
    "company": "ZOLARITY",
    "email": "wolfefowler@zolarity.com",
    "phone": "+1 (816) 417-2125",
    "address": "388 Atlantic Avenue, Englevale, Federated States Of Micronesia, 7097",
    "about": "Laborum culpa laborum magna ea ipsum esse ut ea id magna exercitation nostrud. Reprehenderit sit id labore sunt nulla aliqua aliqua voluptate elit dolore. Incididunt consequat qui velit do culpa commodo irure. Officia elit pariatur sunt ut ipsum magna ex ex ullamco sit elit nulla sint. Eu dolore officia aliqua anim adipisicing tempor tempor dolore sit magna non anim. Duis sint cupidatat do aute consectetur ut Lorem sint dolore est amet amet ipsum. Minim officia nisi nulla labore duis voluptate laboris eiusmod esse aute.\r\n",
    "registered": "2020-08-26T02:33:28 +07:00",
    "latitude": -47.83997,
    "longitude": 144.198581
  },
    {
    "_id": "61b3cf11a088a65998a51ad3",
    "index": 0,
    "guid": "77a8771a-d7ee-40cc-9c94-c762ba87d44f",
    "isActive": true,
    "balance": "$2,158.64",
    "picture": "http://placehold.it/32x32",
    "age": 28,
    "eyeColor": "blue",
    "name": "Scott Cantrell",
    "gender": "male",
    "company": "IZZBY",
    "email": "scottcantrell@izzby.com",
    "phone": "+1 (903) 513-3390",
    "address": "480 Lake Avenue, Gulf, Rhode Island, 3364",
    "about": "Irure esse veniam aliquip ea reprehenderit commodo eiusmod occaecat dolore esse est. Magna sit anim commodo occaecat eu nostrud sunt incididunt elit cupidatat adipisicing non nisi. Culpa proident magna pariatur amet culpa culpa id mollit. Quis incididunt et culpa laborum esse dolor laboris pariatur tempor do duis anim non adipisicing.\r\n",
    "registered": "2016-01-28T01:06:59 +08:00",
    "latitude": -11.980193,
    "longitude": 64.071912
  },
  {
    "_id": "61b3cf11cda68a359d28081d",
    "index": 1,
    "guid": "0c12713e-e5e1-4d03-9611-650da5a41da4",
    "isActive": true,
    "balance": "$1,266.14",
    "picture": "http://placehold.it/32x32",
    "age": 38,
    "eyeColor": "green",
    "name": "Paula Gilbert",
    "gender": "female",
    "company": "SLUMBERIA",
    "email": "paulagilbert@slumberia.com",
    "phone": "+1 (842) 568-3436",
    "address": "193 Fiske Place, Orin, Wisconsin, 6080",
    "about": "Aliqua exercitation amet anim irure elit ullamco est adipisicing anim eu velit. Duis irure sit mollit magna dolore. Nostrud amet tempor commodo aute tempor dolor duis anim adipisicing sit est. Nostrud excepteur officia duis sunt ut et duis. Commodo voluptate enim est sint ex. Quis ut ullamco duis qui cupidatat cillum est.\r\n",
    "registered": "2014-02-11T06:40:50 +08:00",
    "latitude": 67.749747,
    "longitude": 23.706625
  },
  {
    "_id": "61b3cf11b8d845b1e70b9341",
    "index": 2,
    "guid": "4671ce68-5d38-4b3f-a9b7-e88665505b52",
    "isActive": false,
    "balance": "$1,970.27",
    "picture": "http://placehold.it/32x32",
    "age": 24,
    "eyeColor": "brown",
    "name": "Penelope Gordon",
    "gender": "female",
    "company": "BUZZOPIA",
    "email": "penelopegordon@buzzopia.com",
    "phone": "+1 (928) 522-3453",
    "address": "966 Bogart Street, Tuttle, Louisiana, 1371",
    "about": "Elit ea proident est aliquip adipisicing commodo proident minim ut aute proident laborum. Est laboris Lorem non ipsum commodo reprehenderit reprehenderit laborum. Deserunt minim fugiat velit nostrud id ipsum. Mollit quis aliqua nisi aliqua anim. Non nulla deserunt elit quis aliqua consectetur irure veniam incididunt ipsum.\r\n",
    "registered": "2019-09-07T06:55:38 +07:00",
    "latitude": 64.368999,
    "longitude": 13.754936
  },
  {
    "_id": "61b3cf116a2590406a734b75",
    "index": 3,
    "guid": "981a3a7d-79df-4c64-968b-a5197f4c783d",
    "isActive": false,
    "balance": "$1,070.57",
    "picture": "http://placehold.it/32x32",
    "age": 37,
    "eyeColor": "blue",
    "name": "Leanna Frank",
    "gender": "female",
    "company": "BIOHAB",
    "email": "leannafrank@biohab.com",
    "phone": "+1 (809) 462-2348",
    "address": "261 Metrotech Courtr, Fairlee, Idaho, 481",
    "about": "Officia esse occaecat tempor excepteur eiusmod consequat aliqua dolore nostrud non anim est eiusmod. Laboris voluptate ullamco cillum qui ut ex laborum velit irure sint esse. Esse non non deserunt dolore. Occaecat eu sit id id exercitation ipsum. Ea ex amet voluptate non consequat commodo cupidatat nisi magna eiusmod. Consequat Lorem sint tempor in.\r\n",
    "registered": "2021-06-11T02:50:43 +07:00",
    "latitude": 22.327039,
    "longitude": -99.142233
  },
  {
    "_id": "61b3cf1127d71fa77914b0f0",
    "index": 4,
    "guid": "0b7f2da6-bf24-468b-9458-2447f0ed2ea5",
    "isActive": false,
    "balance": "$3,833.53",
    "picture": "http://placehold.it/32x32",
    "age": 26,
    "eyeColor": "blue",
    "name": "Wolfe Fowler",
    "gender": "male",
    "company": "ZOLARITY",
    "email": "wolfefowler@zolarity.com",
    "phone": "+1 (816) 417-2125",
    "address": "388 Atlantic Avenue, Englevale, Federated States Of Micronesia, 7097",
    "about": "Laborum culpa laborum magna ea ipsum esse ut ea id magna exercitation nostrud. Reprehenderit sit id labore sunt nulla aliqua aliqua voluptate elit dolore. Incididunt consequat qui velit do culpa commodo irure. Officia elit pariatur sunt ut ipsum magna ex ex ullamco sit elit nulla sint. Eu dolore officia aliqua anim adipisicing tempor tempor dolore sit magna non anim. Duis sint cupidatat do aute consectetur ut Lorem sint dolore est amet amet ipsum. Minim officia nisi nulla labore duis voluptate laboris eiusmod esse aute.\r\n",
    "registered": "2020-08-26T02:33:28 +07:00",
    "latitude": -47.83997,
    "longitude": 144.198581
  }
  ],
  initialSortBy: [{ id: 'name', desc: true }],
  noDataText: 'No data here',
  showRowCount: true,
    scrollTable: true,

  //columns: [
  //  {
  //    accessor: 'id',
  //    Header: 'ID',
  //    sortable: true,
  //  },
  //  {
  //    accessor: 'age',
  //    Header: 'Age',
  //  },
  //  {
  //    accessor: 'name',
  //    Header: 'Name',
  //  },
  //],
  //data: [
  //  { id: 423, age: 7, name: 'Don' },
  //  { id: 351, age: 20, name: 'Kit' },
  //  { id: 133, age: 47, name: 'Emi' },
  //  { id: 391, age: 30, name: 'Alex' },
  //  { id: 103, age: 37, name: 'Joe' },
  //  { id: 381, age: 50, name: 'Clare' },
  //  { id: 153, age: 17, name: 'Frank' },
  //  { id: 301, age: 70, name: 'Bob' },
  //  { id: 223, age: 97, name: 'Celeste' },
  //  { id: 221, age: 30, name: 'Marian' },
  //  { id: 423, age: 27, name: 'Jake' },
  //  { id: 323, age: 70, name: 'John' },
  //  { id: 124, age: 67, name: 'Fred' },
  //  { id: 325, age: 60, name: 'Maria' },
  //  { id: 126, age: 57, name: 'Emily' },
  //  { id: 327, age: 11, name: 'Kate' },
  //],
  //initialSortBy: [{ id: 'name', desc: true }],
  //noDataText: 'No data here',
  //showRowCount: true,
  //  scrollTable: true,
};

InteractiveResizableTable.argTypes = {
  emptyWrapperType: {
    control: {
      type: 'select',
      options: [EmptyWrapperType.Default, EmptyWrapperType.Small],
    },
  },
  pageSize: {
    control: {
      type: 'number',
      min: 1,
    },
  },
  initialPageIndex: {
    control: {
      type: 'number',
      min: 0,
    },
  },
};

InteractiveResizableTable.story = {
  parameters: {
    knobs: {
      disable: true,
    },
  },
};
