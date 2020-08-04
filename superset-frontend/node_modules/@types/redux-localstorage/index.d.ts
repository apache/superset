// Type definitions for redux-localstorage 1.0
// Project: https://github.com/elgerlambert/redux-localstorage
// Definitions by: Karol Janyst <https://github.com/LKay>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

import * as Redux from "redux";

export interface ActionTypes {
    INIT: string;
}

export type AdapterCallback = <A>(err?: any, result?: A) => void;

export interface StorageAdapter<A> {
    0: A;
    put(key: string, value: any, callback: AdapterCallback): void;
    get(key: string, callback: AdapterCallback): void;
    del(key: string, callback: AdapterCallback): void;
}

export type StorageAdapterCreator<A> = (storage: A) => StorageAdapter<A>;

export interface StorageAdapterEnhancer {}

export function mergePersistedState(merge?: <A1, A2>(initialState: A1, persistentState: A2) => A1 & A2): <A>(next: Redux.Reducer<A>) => Redux.Reducer<A>;

export default function persistState<A>(storage?: StorageAdapter<A>, key?: string, callback?: Function): Redux.GenericStoreEnhancer;

export function transformState<A1, A2>(down: ((state: A1) => A2) | Array<(state: any) => any>, up: ((state: A2) => A1) | Array<(state: any) => any>): (storage: StorageAdapter<A1>) => A2;

export const actionTypes: ActionTypes;
