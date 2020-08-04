// @flow

class ParsingError extends Error {
    key: string;
    message: string;
    constructor(key: string, message: string) {
        super(message);
        this.message = message;
        this.key = key;
    }
}

export default ParsingError;
