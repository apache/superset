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

declare module 'react-lines-ellipsis' {
  interface ReactLinesEllipsisProps {
    basedOn?: 'letters' | 'words';
    className?: string;
    component?: string;
    ellipsis?: string;
    isClamped?: () => boolean;
    maxLine?: number | string;
    onReflow?: ({ clamped, text }: { clamped: boolean; text: string }) => any;
    style?: React.CSSProperties;
    text?: string;
    trimRight?: boolean;
    winWidth?: number;
  }

  // eslint-disable-next-line react/prefer-stateless-function
  class LinesEllipsis extends React.Component<ReactLinesEllipsisProps> {
    static defaultProps?: ReactLinesEllipsisProps;
  }

  export default LinesEllipsis;
}

declare module 'react-lines-ellipsis/lib/responsiveHOC' {
  export default function responsiveHOC(): <P extends object>(
    WrappedComponent: React.ComponentType<P>,
  ) => React.ComponentClass<P>;
}
