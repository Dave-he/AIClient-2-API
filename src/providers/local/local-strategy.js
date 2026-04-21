import { LocalApiService } from './local-core.js';
import { ApiServiceAdapter } from '../api-service-adapter-base.js';

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

    async listRunningModels() {
        return this.localApiService.listRunningModels();
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

    async getModelOptions() {
        return this.localApiService.getModelOptions();
    }

    async getCurrentModel() {
        return this.localApiService.getCurrentModel();
    }

    async switchModel(targetModelName, options = {}) {
        return this.localApiService.switchModel(targetModelName, options);
    }
}