export default {
  projects: [
    {
      testEnvironment: 'jsdom',
      transform: {
        '^.+\\.(js|mjs)$': 'babel-jest',
        '^.+\\.vue$': '@vue/vue3-jest',
      },
      transformIgnorePatterns: [
        '/node_modules/',
      ],
      testMatch: [
        '**/tests/e2e/**/*.test.js',
        '**/tests/components/**/*.test.js',
      ],
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
        '@/(.*)': '<rootDir>/src/$1',
        '\\.(css|less|scss)$': 'jest-transform-stub'
      },
      testTimeout: 30000
    },
    {
      testEnvironment: 'node',
      transform: {
        '^.+\\.(js|mjs)$': 'babel-jest',
      },
      transformIgnorePatterns: [],
      testMatch: [
        '**/tests/**/*.unit.test.js',
        '**/tests/**/*.test.js',
        '!**/tests/e2e/**/*.test.js',
        '!**/tests/components/**/*.test.js',
        '!**/tests/*-stress.test.js',
        '!**/tests/auto-rate-limit-binary.test.js',
      ],
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
        '@/(.*)': '<rootDir>/src/$1',
        'uuid': '<rootDir>/tests/mocks/uuid.js'
      },
      testTimeout: 30000
    }
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!**/node_modules/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html']
};