// AI Flow Configuration
// This file configures the AI Flow development workflow for this project

export default {
  // 项目基本信息
  project: {
    name: 'aiclient-2-api',
    type: 'node',
    platform: 'codeflicker',
  },

  // 目录配置
  directories: {
    root: '.',
    src: 'src',
    tests: 'tests',
    docs: 'docs',
    snippets: '.codeflicker/snippets',
    tasks: 'docs/tasks',
    research: 'docs/research',
  },

  // 开发命令配置
  commands: {
    dev: 'pnpm dev',
    start: 'pnpm start',
    test: 'pnpm test',
    'test:unit': 'pnpm test:unit',
    'test:integration': 'pnpm test:integration',
    'test:e2e': 'pnpm test:e2e',
    lint: 'pnpm lint || true',
    build: 'pnpm build',
    'build:vue': 'pnpm build:vue',
  },

  // 代码片段配置
  snippets: {
    enabled: true,
    categories: ['utils', 'api', 'middleware', 'providers', 'converters'],
    maxFiles: 50,
    minScore: 1.0,
  },

  // 研发资产审查配置
  rdAssetReview: {
    enabled: true,
    extractSnippets: true,
    generateIndex: true,
    outputDir: 'docs/research',
  },

  // 多仓配置（单仓模式）
  multiRepo: {
    enabled: false,
  },

  // AI Flow 预设
  preset: 'balanced',

  // CLI 配置（自动从项目级 config.json 读取）
  cli: {
    model: null,
    approvalMode: null,
    thinkingLevel: null,
  },
};
