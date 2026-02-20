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

import {
    ChartDataResponseResult,
    DataRecordValue,
    normalizeTimestamp,
    TimeFormatter,
    ValueFormatter,
} from '@superset-ui/core';

export enum GenericDataType {
    Numeric = 'NUMERIC',
    String = 'STRING',
    Temporal = 'TEMPORAL',
    Boolean = 'BOOLEAN',
}
import { NULL_STRING } from '../constants';

export function formatSeriesName(
    name: DataRecordValue | undefined,
    {
        numberFormatter,
        timeFormatter,
        coltype,
    }: {
        numberFormatter?: ValueFormatter;
        timeFormatter?: TimeFormatter;
        coltype?: GenericDataType;
    } = {},
): string {
    if (name === undefined || name === null) {
        return NULL_STRING;
    }
    if (typeof name === 'boolean' || typeof name === 'bigint') {
        return name.toString();
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (name instanceof Date || (coltype as any) === GenericDataType.Temporal) {
        const normalizedName =
            typeof name === 'string' ? normalizeTimestamp(name) : name;
        const d =
            normalizedName instanceof Date
                ? normalizedName
                : new Date(normalizedName);

        return timeFormatter ? timeFormatter(d) : d.toISOString();
    }
    if (typeof name === 'number') {
        return numberFormatter ? numberFormatter(name) : name.toString();
    }
    return name;
}

export const getColtypesMapping = ({
    coltypes = [],
    colnames = [],
}: Pick<ChartDataResponseResult, 'coltypes' | 'colnames'>): Record<
    string,
    any
> =>
    colnames.reduce(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (accumulator: Record<string, any>, item: string, index: number) => ({
            ...accumulator,
            [item]: coltypes[index],
        }),
        {},
    );
