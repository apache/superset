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
import React from 'react';
import { t } from '@superset-ui/translation';
import withToasts from 'src/messageToasts/enhancers/withToasts';

interface Arr {
  func: () => void;
}
interface CommonObject {
  flash_messages: Arr[]; 
}
interface Props {
  children: Node;
  common: CommonObject;
};

const flashObj = {
  info: 'addInfoToast',
  danger: 'addDangerToast',
  warning: 'addWarningToast',
  success: 'addSuccessToast',
};

class FlashProvider extends React.PureComponent<Props> {
  componentDidMount() {
    const flashArr = this.props.common.flash_messages as Arr[];
    if (flashArr.length > 0) {
      flashArr.forEach((item, i) => {
        const type = item[i][0];
        const text = item[i][1];
        const flash = flashObj[type];
        this.props[flash](t(text));
      });
    }
  }
  render() {
    return this.props.children;
  }
}

export default withToasts(FlashProvider);
