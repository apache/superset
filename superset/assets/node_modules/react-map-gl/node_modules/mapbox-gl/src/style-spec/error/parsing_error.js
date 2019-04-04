
function ParsingError(error) {
    this.error = error;
    this.message = error.message;
    const match = error.message.match(/line (\d+)/);
    this.line = match ? parseInt(match[1], 10) : 0;
}

export default ParsingError;
