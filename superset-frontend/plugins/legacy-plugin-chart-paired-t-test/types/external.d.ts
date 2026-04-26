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
declare module '*.png' {
  const value: string;
  export default value;
}

declare module '*.jpg' {
  const value: string;
  export default value;
}

declare module 'distributions' {
  class Studentt {
    constructor(degreesOfFreedom: number);
    cdf(x: number): number;
  }
  const dist: {
    Studentt: typeof Studentt;
  };
  export default dist;
}

declare module 'reactable' {
  import { ComponentType, ReactNode } from 'react';

  interface TableProps {
    className?: string;
    id?: string;
    sortable?: (
      | string
      | {
          column: string;
          sortFunction: (a: string, b: string) => number;
        }
    )[];
    children?: ReactNode;
  }

  interface TrProps {
    className?: string;
    onClick?: () => void;
    children?: ReactNode;
  }

  interface TdProps {
    className?: string;
    column?: string;
    data?: string | number | boolean;
    children?: ReactNode;
  }

  interface ThProps {
    column?: string;
    children?: ReactNode;
  }

  interface TheadProps {
    children?: ReactNode;
  }

  export const Table: ComponentType<TableProps>;
  export const Tr: ComponentType<TrProps>;
  export const Td: ComponentType<TdProps>;
  export const Th: ComponentType<ThProps>;
  export const Thead: ComponentType<TheadProps>;
}
