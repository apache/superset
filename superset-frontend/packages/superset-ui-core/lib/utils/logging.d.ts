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
declare const logger: {
    log: (...data: any[]) => void;
    debug: (...data: any[]) => void;
    info: (...data: any[]) => void;
    warn: (...data: any[]) => void;
    error: (...data: any[]) => void;
    trace: (...data: any[]) => void;
    table: (tabularData?: any, properties?: string[] | undefined) => void;
};
/**
 * Superset frontend logger, currently just an alias to console.
 * This may be extended to support numerous console operations safely
 * i.e.: https://developer.mozilla.org/en-US/docs/Web/API/Console
 */
export default logger;
//# sourceMappingURL=logging.d.ts.map