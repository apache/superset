import {Env, p, getTestFiles, getTestEvents} from './mocks/env'

let env: Env

it('set default inputs', () => {
  const input = p.changedFilesInput()
  const defaultFormats = ['json', ',', ' ', '_<br />&nbsp;&nbsp;_']
  expect(input.length).toBe(4)
  input.forEach((t, i) => {
    expect(t.events).toBe('pull')
    if (Array.isArray(t.inputs)) {
      expect(t.inputs[0]).toBe(defaultFormats[i])
      expect(t.inputs[1]).toBe(p.normalFileArray)
      if (defaultFormats[i] === 'json')
        expect(t.inputs[2]).toBe(JSON.stringify(t.inputs[1]))
      else if (Array.isArray(t.inputs[1]))
        expect(t.inputs[2]).toBe(t.inputs[1].join(defaultFormats[i]))
    }
  })
  expect(input[0].events).toBe('pull')
})

describe('Testing payloads.ts...', () => {
  describe.each([
    {files: ['/test/file', '/test/file2']},
    {files: ['/test/&&&file', '/test/&&&file2']},
    {files: ['/test/f&*(@mafile1', '/test/f&*(@mafile2']},
    {files: ['/test/ke_c``ommands1', '/test/ke_c``ommands2']}
  ])('...changedFilesInput default with files %p...', files => {
    describe.each(['json', ',', ' ', '_<br />&nbsp;&nbsp;_'])(
      '...with format %s...',
      format => {
        it(`set default inputs files:${JSON.stringify(
          files,
          null,
          2
        )} format:${format}`, () => {
          const input = p.changedFilesInput('pull', files.files, [format])
          expect(input.length).toBe(1)
          expect(input[0].events).toBe('pull')
          if (Array.isArray(input[0].inputs)) {
            expect(input[0].inputs[0]).toBe(format)
            expect(input[0].inputs[1]).toBe(files.files)
            if (format === 'json' && Array.isArray(input[0].inputs[2]))
              expect(input[0].inputs[2]).toBe(
                `[ "${input[0].inputs[2][0]}", "${input[0].inputs[2][1]}" ]`
              )
            else if (
              Array.isArray(input[0].inputs[1]) &&
              Array.isArray(input[0].inputs[2])
            ) {
              expect(input[0].inputs[2]).toBe(
                `${input[0].inputs[2][0]}${format}${input[0].inputs[2][1]}`
              )
            }
          }
        })
      }
    )
  })
})
