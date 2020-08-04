/*
 * Copyright 2018-2019 Uber Technologies, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-env browser */

import Benchmark from 'benchmark';
import makeBenchmarks from './benchmarks';

window.Benchmark = Benchmark;

// Initial message
const header = document.createElement('h2');
header.style.cssText = `
    font-family: Helvetica, sans-serif;
    font-size: 24px;
    margin: 1rem;
    color: darkgrey;
`;
header.innerHTML = 'Running benchmarks...';
document.body.appendChild(header);

const suite = makeBenchmarks();

suite
    .on('cycle', event => {
        const result = document.createElement('p');
        result.style.cssText = `
            font-family: Helvetica, sans-serif;
            font-size: 18px;
            color: grey;
            margin: 1rem;
            padding-bottom: 1em;
            border-bottom: 1px dashed grey;
        `;
        /* eslint-disable no-unused-vars */
        // Break up the message so that we can color it nicely
        const [_, method, x, ops, errata] = String(event.target).match(/^(\w+)( x )([\d,]+)(.*)$/);
        result.innerHTML = `
            <span style="color: darkblue">${method}</span>
            ${x}
            <span style="color: red">${ops}</span>
            ${errata}
        `;
        document.body.appendChild(result);
    })
    .run({async: true});
