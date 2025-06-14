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
import BoundsControl, { BoundsControlProps } from './BoundsControl';

export default {
  title: 'BoundsControl',
  component: BoundsControl,
};

export const InteractiveBoundsControl = (
  args: BoundsControlProps & { initialMin: number; initialMax: number },
) => {
  const { initialMin, initialMax, ...props } = args;

  return (
    <>
      <BoundsControl {...props} value={[initialMin, initialMax]} />
    </>
  );
};

InteractiveBoundsControl.args = {
  initialMin: 0,
  initialMax: 50,
};

InteractiveBoundsControl.argTypes = {
  onChange: { action: 'onChange' },
};
