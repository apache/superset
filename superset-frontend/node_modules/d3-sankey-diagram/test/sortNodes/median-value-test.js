import medianValue from '../../src/sortNodes/median-value.js'
import tape from 'tape'

tape('medianValue', test => {
  test.equal(medianValue([3, 4, 6]), 4,
             'picks out middle value')

  test.equal(medianValue([3, 4]), 3.5,
             'returns average of 2 values')

  test.equal(medianValue([]), -1,
             'returns -1 for empty list of positions')

  test.equal(medianValue([0, 5, 6, 7, 8, 9]), 6.75,
             'weighted median for even number of positions')

  test.end()
})
