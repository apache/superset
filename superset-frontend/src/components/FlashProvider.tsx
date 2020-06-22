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
import withToasts from 'src/messageToasts/enhancers/withToasts';

type Message = Array<string>;

interface CommonObject {
  flash_messages: Array<Message>;
}
interface Props {
  children: Node;
  common: CommonObject;
}

const flashObj = {
  info: 'addInfoToast',
  danger: 'addDangerToast',
  warning: 'addWarningToast',
  success: 'addSuccessToast',
};

class FlashProvider extends React.PureComponent<Props> {
  componentDidMount() {
    const flashMessages = this.props.common.flash_messages;
    flashMessages.forEach(message => {
      const [type, text] = message;
      const flash = flashObj[type];
      this.props[flash](text);
    });
  }
  render() {
    return this.props.children;
  }
}

export default withToasts(FlashProvider);
