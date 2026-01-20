module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages'],
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
      displayName: 'unit',
      preset: 'ts-jest',
      testMatch: ['<rootDir>/packages/*/tests/**/*.test.ts', '!**/*.integration.test.ts'],
      collectCoverageFrom: ['packages/*/src/**/*.ts', '!**/*.test.ts'],
      transform: {
        '^.+\\.ts$': ['ts-jest', {
          tsconfig: {
            module: 'commonjs',
            esModuleInterop: true,
          },
        }],
      },
    },
    {
      displayName: 'integration',
      preset: 'ts-jest',
      testMatch: ['<rootDir>/packages/*/tests/**/*.integration.test.ts'],
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
