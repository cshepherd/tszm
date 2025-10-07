module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  roots: ['<rootDir>'],

  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],

  coverageReporters: ['text', 'lcov', 'json-summary'],

  collectCoverageFrom: [
    'opcodes/**/*.ts',
    '!**/*.d.ts',
    '!**/*.(spec|test).ts',
  ],

  coveragePathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/tszm.ts',
  ],

  // Start with global thresholds just below your “all files” numbers
  coverageThreshold: {
    global: {
      statements: 72,
      branches:   69,
      functions:  50,
      lines:      72,
    },
  },
};

