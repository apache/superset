importScripts('ocrad.js')
onmessage = function(e){
	postMessage(OCRAD(e.data))
}