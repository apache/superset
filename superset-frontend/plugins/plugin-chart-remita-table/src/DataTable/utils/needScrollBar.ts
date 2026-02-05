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
/**
 * Whether a container need scroll bars when in another container.
 */
export default function needScrollBar({
  width,
  height,
  innerHeight,
  innerWidth,
  scrollBarSize,
}: {
  width: number;
  height: number;
  innerHeight: number;
  scrollBarSize: number;
  innerWidth: number;
}): [boolean, boolean] {
  const hasVerticalScroll = innerHeight > height;
  const hasHorizontalScroll =
    innerWidth > width - (hasVerticalScroll ? scrollBarSize : 0);
  return [hasVerticalScroll, hasHorizontalScroll];
}
