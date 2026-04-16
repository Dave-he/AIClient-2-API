import { LocalApiService } from './local-core.js';
import { ApiServiceAdapter } from '../adapter.js';

export class LocalApiServiceAdapter extends ApiServiceAdapter {
    constructor(config) {
        super();
        this.localApiService = new LocalApiService(config);
    }

    async generateContent(model, requestBody) {
        return this.localApiService.generateContent(model, requestBody);
    }

    async *generateContentStream(model, requestBody) {
        yield* this.localApiService.generateContentStream(model, requestBody);
    }

    async listModels() {
        return this.localApiService.listModels();
    }

    async refreshToken() {
        return Promise.resolve();
    }

    async forceRefreshToken() {
        return Promise.resolve();
    }

    isExpiryDateNear() {
        return false;
    }

    async getGPUStatus() {
        return this.localApiService.getGPUStatus();
    }

    async startModel(modelName) {
        return this.localApiService.startModel(modelName);
    }

    async stopModel(modelName) {
        return this.localApiService.stopModel(modelName);
    }
}