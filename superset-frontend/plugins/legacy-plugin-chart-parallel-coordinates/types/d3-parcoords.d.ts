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
declare module './vendor/parcoords/d3.parcoords' {
  function parcoords(config?: Record<string, unknown>): (
    selection: Element | null,
  ) => Record<string, Function> & {
    width: Function;
    height: Function;
    color: Function;
    alpha: Function;
    composite: Function;
    data: Function;
    dimensions: Function;
    types: Function;
    render: Function;
    createAxes: Function;
    shadows: Function;
    reorderable: Function;
    brushMode: Function;
    highlight: Function;
    unhighlight: Function;
    on: Function;
  };
  export default parcoords;
}

declare module './vendor/parcoords/divgrid' {
  function divgrid(config?: Record<string, unknown>): Function;
  export default divgrid;
}
