let emptyImage
export default function getEmptyImage() {
	if (!emptyImage) {
		emptyImage = new Image()
		emptyImage.src =
			'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='
	}

	return emptyImage
}
