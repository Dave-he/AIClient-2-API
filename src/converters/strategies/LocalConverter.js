import { BaseConverter } from '../BaseConverter.js';

export class LocalConverter extends BaseConverter {
    constructor() {
        super();
        this.protocol = 'local';
    }

    convertRequest(requestBody, options = {}) {
        return requestBody;
    }

    convertResponse(response, options = {}) {
        return response;
    }

    convertStream(chunk, options = {}) {
        return chunk;
    }

    convertModelName(modelName, options = {}) {
        return modelName;
    }
}