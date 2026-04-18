export class ApiServiceAdapter {
    constructor() {
        if (new.target === ApiServiceAdapter) {
            throw new TypeError("Cannot construct ApiServiceAdapter instances directly");
        }
    }

    async generateContent(model, requestBody) {
        throw new Error("Method 'generateContent()' must be implemented.");
    }

    async *generateContentStream(model, requestBody) {
        throw new Error("Method 'generateContentStream()' must be implemented.");
    }

    async listModels() {
        throw new Error("Method 'listModels()' must be implemented.");
    }

    async refreshToken() {
        throw new Error("Method 'refreshToken()' must be implemented.");
    }

    async forceRefreshToken() {
        throw new Error("Method 'forceRefreshToken()' must be implemented.");
    }

    isExpiryDateNear() {
        throw new Error("Method 'isExpiryDateNear()' must be implemented.");
    }
}