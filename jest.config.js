module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.ts', '**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^expo-calendar/legacy$': '<rootDir>/test/mocks/expo-calendar-mock.ts',
    '^expo-calendar$': '<rootDir>/test/mocks/expo-calendar-mock.ts',
    '^expo-sqlite$': '<rootDir>/test/mocks/expo-sqlite-mock.ts',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { strict: true, types: ['jest'] } }],
  },
};
