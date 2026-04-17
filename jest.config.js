export default {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.(js|mjs)$': 'babel-jest',
    '^.+\\.vue$': 'jest-transform-stub',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(uuid)/)',
  ],
  globals: {
    'jest': {
      useESM: true
    }
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '\\.(css|less|scss)$': 'jest-transform-stub'
  },
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!**/node_modules/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 30000
};
