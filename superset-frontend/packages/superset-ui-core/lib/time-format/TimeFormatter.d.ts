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
import { ExtensibleFunction } from '../models';
import { TimeFormatFunction } from './types';
export declare const PREVIEW_TIME: Date;
interface TimeFormatter {
    (value: Date | number | null | undefined): string;
}
declare class TimeFormatter extends ExtensibleFunction {
    id: string;
    label: string;
    description: string;
    formatFunc: TimeFormatFunction;
    useLocalTime: boolean;
    constructor(config: {
        id: string;
        label?: string;
        description?: string;
        formatFunc: TimeFormatFunction;
        useLocalTime?: boolean;
    });
    format(value: Date | number | null | undefined): string;
    preview(value?: Date): string;
}
export default TimeFormatter;
//# sourceMappingURL=TimeFormatter.d.ts.map