var big5Table = require('./table/big5.js');
module.exports = {
	'windows950': 'big5',
	'cp950': 'big5',
	'big5': {
		type: 'table',
		table: big5Table
	}
}
