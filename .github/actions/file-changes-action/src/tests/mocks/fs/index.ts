import {FsMock} from 'typings/FsMock'

const fsMock = {
  writeFileSync: jest.fn((path, data, options) => {
    if (path === 'error')
      throw new Error(JSON.stringify({name: 'PathError', status: '500'}))
    // console.log(`fs.writeFileSync triggered with path: ${path} data: ${data} options: ${options}`)
  })
}

export function mock(): FsMock {
  jest.mock('fs', () => fsMock)
  return fsMock
}
