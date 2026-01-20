module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages'],
  globalSetup: '<rootDir>/tests/helpers/globalSetup.ts',
  globalTeardown: '<rootDir>/tests/helpers/globalTeardown.ts',
  testTimeout: parseInt(process.env.TEST_TIMEOUT_MS || '30000', 10),
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        esModuleInterop: true,
      },
    }],
  },
  projects: [
    {
      displayName: 'packages',
      preset: 'ts-jest',
      testMatch: ['<rootDir>/packages/*/tests/**/*.test.ts'],
      collectCoverageFrom: ['packages/*/src/**/*.ts', '!**/*.test.ts'],
      globalSetup: '<rootDir>/tests/helpers/globalSetup.ts',
      globalTeardown: '<rootDir>/tests/helpers/globalTeardown.ts',
      setupFilesAfterEnv: ['<rootDir>/tests/helpers/setup.ts'],
      transform: {
        '^.+\\.ts$': ['ts-jest', {
          tsconfig: {
            module: 'commonjs',
            esModuleInterop: true,
          },
        }],
      },
    },
  ],
};
