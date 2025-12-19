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
import { ListViewCard } from '.';

export default {
  title: 'Components/ListViewCard',
  component: ListViewCard,
  argTypes: {
    loading: { control: 'boolean' },
  },
};

export const SupersetListViewCard = ({
  loading = false,
}: {
  loading?: boolean;
}) => (
  <ListViewCard
    title="Superset Card Title"
    loading={loading}
    url="/superset/dashboard/births/"
    imgURL="https://images.unsplash.com/photo-1658163724548-29ef00812a54?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2670&q=80"
    imgFallbackURL="https://images.unsplash.com/photo-1658208193219-e859d9771912?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2670&q=80"
    description="Lorem ipsum dolor sit amet, consectetur adipiscing elit..."
    coverLeft="Left Section"
    coverRight="Right Section"
  />
);
