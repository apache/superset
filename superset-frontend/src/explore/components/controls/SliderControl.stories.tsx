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
import SliderControl from './SliderControl';

export default {
  title: 'SliderControl',
  component: SliderControl,
};

const options = {
  value: {
    value: 25,
  },
  default: {
    default: 50,
  },
};

export const SliderControlGallery = () => (
  <>
    {Object.keys(options).map(name => (
      <>
        <h4>{name}</h4>
        <SliderControl {...options[name]} />
      </>
    ))}
  </>
);
