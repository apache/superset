/// <reference types="node" />

import { Profiler } from 'inspector'
import { CoverageMapData } from 'istanbul-lib-coverage'
import { RawSourceMap } from 'source-map'

declare type Sources =
  | {
      source: string
    }
  | {
      source: string
      originalSource: string
      sourceMap: { sourcemap: RawSourceMap }
    }
declare class V8ToIstanbul {
  load(): Promise<void>
  applyCoverage(blocks: ReadonlyArray<Profiler.FunctionCoverage>): void
  toIstanbul(): CoverageMapData
}

declare function v8ToIstanbul(scriptPath: string, wrapperLength?: number, sources?: Sources): V8ToIstanbul

export = v8ToIstanbul
