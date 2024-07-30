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
  createContext,
  FC,
  useRef,
  useMemo,
  useContext,
  useState,
} from 'react';
import type { Position as AcePosition } from 'brace';

export type AceToken = {
  type: string;
  value: string;
  index: number;
  start?: number;
};

export enum MetadataType {
  TABLE = 'table',
}

export type TokenMetadata = {
  type: string;
  value: string;
  title: string;
  dbId: number | string;
  schema?: string;
  catalog?: string | null;
};

export type LookUpParams = {
  token: AceToken;
  siblingTokens: AceToken[];
  position: AcePosition;
};

export type ValidatorFuncType = (
  lookUpParams: LookUpParams,
) => TokenMetadata | undefined;

type TokenData = {
  metadataType: MetadataType;
  metadata?: TokenMetadata;
  markerStyle?: {
    x: number;
    y: number;
    width: number;
  };
};

type ContextProps = {
  setValidators: (key: MetadataType, validator: ValidatorFuncType) => void;
  getMatchTokenData: (
    lookUpParams: LookUpParams,
  ) => [MetadataType, TokenMetadata] | undefined;
  setActiveTokenData: (data: TokenData) => void;
};

const TokenContext = createContext<ContextProps>({
  setValidators: () => {},
  getMatchTokenData: () => undefined,
  setActiveTokenData: () => {},
});
const ActiveTokenContext = createContext<TokenData | undefined>(undefined);

export const useTokenContext = () => useContext(TokenContext);
export const useActiveTokenContext = () => useContext(ActiveTokenContext);

const AceEditorTokenProvider: FC = ({ children }) => {
  const validationsRef = useRef<Record<MetadataType, ValidatorFuncType>>();
  const [activeTokenData, setActiveTokenData] = useState<TokenData>();

  const contextValue = useMemo(
    () => ({
      setValidators: (key: MetadataType, validator: ValidatorFuncType) => {
        validationsRef.current = {
          ...validationsRef.current,
          [key]: validator,
        };
      },
      getMatchTokenData: (params: LookUpParams) =>
        validationsRef.current &&
        (Object.entries(validationsRef.current)
          .map(([key, validate]) => [key, validate(params)])
          .find(([, metadata]) => Boolean(metadata)) as [
          MetadataType,
          TokenMetadata,
        ]),
      setActiveTokenData,
    }),
    [],
  );

  return (
    <TokenContext.Provider value={contextValue}>
      <ActiveTokenContext.Provider value={activeTokenData}>
        {children}
      </ActiveTokenContext.Provider>
    </TokenContext.Provider>
  );
};

export default AceEditorTokenProvider;
