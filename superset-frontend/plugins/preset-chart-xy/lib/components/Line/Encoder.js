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
import createEncoderFactory from 'encodable/lib/encoders/createEncoderFactory';
export const lineEncoderFactory = createEncoderFactory({
    channelTypes: {
        x: 'X',
        y: 'Y',
        fill: 'Category',
        stroke: 'Color',
        strokeDasharray: 'Category',
        strokeWidth: 'Numeric',
    },
    defaultEncoding: {
        x: { field: 'x', type: 'quantitative' },
        y: { field: 'y', type: 'quantitative' },
        fill: { value: false, legend: false },
        stroke: { value: '#222' },
        strokeDasharray: { value: '' },
        strokeWidth: { value: 1 },
    },
});
//# sourceMappingURL=Encoder.js.map