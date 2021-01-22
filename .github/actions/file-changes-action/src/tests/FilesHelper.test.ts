import {Env, p, getTestFiles, getTestEvents} from './mocks/env'

let env: Env

describe('Testing FilesHelper.ts...', () => {
  describe('...with push event...', () => {
    beforeAll(() => {
      env = new Env({}, {githubToken: 'TestToken'}, 'push')
    })
    afterEach(() => {
      process.env = {...env.envStart}
      jest.resetModules()
      env = new Env({}, {}, 'push')
    })
    /**
     * @function sortChangedFiles
     */
    describe('...with function sortChangedFiles...', () => {
      it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])(
        '...correctly sorts GithubFile array into ChangedFiles object %i/10 times',
        () => {
          const {files, stats} = getTestFiles()
          const changedFiles = require('../FilesHelper').sortChangedFiles(files)
          const coreDebug = require('@actions/core').debug
          expect(coreDebug).toHaveBeenCalledWith(
            expect.stringContaining(JSON.stringify(files, null, 2))
          )
          const retStats = {
            files: 0,
            added: 0,
            removed: 0,
            modified: 0,
            renamed: 0
          } as {
            [key: string]: number
          }
          Object.keys(changedFiles).forEach(key => {
            retStats[key] = changedFiles[key].length
          })
          expect(retStats).toStrictEqual(stats)
        }
      )
      it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])(
        '...correctly sorts GithubFile array into ChangedFiles object without filenames %i/10 times',
        () => {
          const {files, stats} = getTestFiles()
          const changedFiles = require('../FilesHelper').sortChangedFiles(files)
          const coreDebug = require('@actions/core').debug
          expect(coreDebug).toHaveBeenCalledWith(
            expect.stringContaining(JSON.stringify(files, null, 2))
          )
          const retStats = {
            files: 0,
            added: 0,
            removed: 0,
            modified: 0,
            renamed: 0
          } as {
            [key: string]: number
          }
          Object.keys(changedFiles).forEach(key => {
            retStats[key] = changedFiles[key].length
          })
          expect(retStats).toStrictEqual(stats)
        }
      )
      it('...throws an error', () => {
        expect(() =>
          require('../FilesHelper').sortChangedFiles({
            filename: '/test/file.txt',
            status: 'noexist'
          })
        ).toThrowError(
          JSON.stringify(
            {
              error: '500/TypeError',
              from: 'sortChangedFiles',
              message: 'There was an issue sorting files changed.',
              payload: JSON.stringify({})
            },
            null,
            2
          )
        )
      })
    })
    /**
     * @function getFormatExt
     */
    describe('...with function getFormatExt...', () => {
      it.each(getTestEvents(p.getFormatExtInputs, 'push'))(
        '...sets %s ext for input "%s" should be "%s"',
        (inputName, input, expected) => {
          const ext = require('../FilesHelper').getFormatExt(input)
          expect(ext).toBe(expected)
        }
      )
    })
    /**
     * @function formatChangedFiles
     */
    describe('...with function formatChangedFiles...', () => {
      it.each(
        getTestEvents(
          p.changedFilesInput('push', ['/test/file', '/test/file2']),
          'push'
        )
      )('... with %o', (format, input, expected) => {
        const ext = require('../FilesHelper').formatChangedFiles(format, input)
        expect(ext).toBe(expected)
        if (format === 'json') expect(ext).toBe(`["${input[0]}","${input[1]}"]`)
        else expect(ext).toBe(`${input[0]}${format}${input[1]}`)
      })
      it.each(getTestEvents(p.changedFilesInput('push'), 'push'))(
        '...formats a big list %s',
        (inputName, input, expected) => {
          const ext = require('../FilesHelper').formatChangedFiles(
            inputName,
            input
          )
          expect(ext).toBe(expected)
        }
      )
    })
    /**
     * @function writeFiles
     */
    describe('...with function writeFiles...', () => {
      it.each(getTestEvents(p.changedFilesInput('push'), 'push'))(
        '...writesFiles %s',
        (inputName, input, expected) => {
          const coreDebug = require('@actions/core').debug
          const fsWriteFilesSync = require('fs').writeFileSync
          const format = require('../FilesHelper').getFormatExt(inputName)
          require('../FilesHelper').writeFiles(inputName, 'testKey', input)
          expect(coreDebug).toHaveBeenCalledWith(
            expect.stringContaining(JSON.stringify(input, null, 2))
          )
          expect(fsWriteFilesSync).toHaveBeenCalledWith(
            `${process.env.HOME}/files_testKey${format}`,
            expected,
            'utf-8'
          )
        }
      )
      it.each(getTestEvents(p.changedFilesInput('push'), 'push'))(
        '...writesFiles %s with files key',
        (inputName, input, expected) => {
          const coreDebug = require('@actions/core').debug
          const fsWriteFilesSync = require('fs').writeFileSync
          const format = require('../FilesHelper').getFormatExt(inputName)
          require('../FilesHelper').writeFiles(inputName, 'files', input)
          expect(coreDebug).toHaveBeenCalledWith(
            expect.stringContaining(JSON.stringify(input, null, 2))
          )
          expect(fsWriteFilesSync).toHaveBeenCalledWith(
            `${process.env.HOME}/files${format}`,
            expected,
            'utf-8'
          )
        }
      )
      it('...throws error', () => {
        const coreDebug = require('@actions/core').debug
        expect(() =>
          require('../FilesHelper').writeFiles('error', 'testKey', 'json')
        ).toThrowError(
          new Error(
            JSON.stringify(
              {
                error: '500/TypeError',
                from: 'writeFiles',
                message: 'There was an issue writing output files.',
                payload: JSON.stringify({})
              },
              null,
              2
            )
          )
        )
        expect(coreDebug).toHaveBeenCalledWith(
          expect.stringContaining(
            `Writing output file ${process.env.HOME}/files_testKey.txt with error and files "json"`
          )
        )
      })
    })
    /**
     * @function writeOutput
     */
    describe('...with function writeOutput...', () => {
      it.each(getTestEvents(p.changedFilesInput('push'), 'push'))(
        '...writeOutput %o',
        (inputName, input, expected) => {
          const coreDebug = require('@actions/core').debug
          const coreSetOutput = require('@actions/core').setOutput
          require('../FilesHelper').writeOutput(inputName, 'testKey', input)
          expect(coreDebug).toHaveBeenCalledWith(
            expect.stringContaining(JSON.stringify(input, null, 2))
          )
          expect(coreSetOutput).toHaveBeenCalledWith(`files_testKey`, expected)
        }
      )
      it.each(getTestEvents(p.changedFilesInput('push'), 'push'))(
        '...writeOutput %o with files key',
        (inputName, input, expected) => {
          const coreDebug = require('@actions/core').debug
          const coreSetOutput = require('@actions/core').setOutput
          require('../FilesHelper').writeOutput(inputName, 'files', input)
          expect(coreDebug).toHaveBeenCalledWith(
            expect.stringContaining(JSON.stringify(input, null, 2))
          )
          expect(coreSetOutput).toHaveBeenCalledWith(`files`, expected)
        }
      )
      it('...throws error', () => {
        const coreDebug = require('@actions/core').debug
        expect(() =>
          require('../FilesHelper').writeOutput('error', 'testKey', 'json')
        ).toThrowError(
          new Error(
            JSON.stringify(
              {
                error: '500/TypeError',
                from: 'writeOutput',
                message: 'There was an issue setting action outputs.',
                payload: JSON.stringify({})
              },
              null,
              2
            )
          )
        )
        expect(coreDebug).toHaveBeenCalledWith(
          'Writing output files_testKey with error and files "json"'
        )
      })
    })
  })
})
