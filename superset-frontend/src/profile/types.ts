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
export type Slice = {
  dttm: number;
  id: number;
  url: string;
  title: string;
  creator?: string;
  creator_url?: string;
  viz_type: string;
};

export type Chart = {
  id: number;
  slice_name: string;
  slice_url: string;
  created_by_name?: string;
  changed_on_dttm: number;
};

export type Activity = {
  action: string;
  item_title: string;
  item_url: string;
  time: number;
};

export type ActivityResult = {
  result: Activity[];
};
