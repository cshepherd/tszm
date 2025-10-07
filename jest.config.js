module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/opcodes', '<rootDir>'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  coverageReporters: ['text', 'lcov', 'json-summary'],
  collectCoverageFrom: [
    'opcodes/**/*.ts',
    '!opcodes/**/*.d.ts',
    '!opcodes/**/*.test.ts',
    '*.ts',
    '!*.test.ts',
    '!*.d.ts',
  ],
};
