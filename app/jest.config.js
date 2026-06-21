/**
 * Headless render smoke-test config for the LUCY 2.0 design system.
 *
 * Scope: MOUNT the ui/ primitives with react-test-renderer to catch runtime render crashes
 * (invalid hooks, undefined token reads, bad SVG ids, etc.) without a device or simulator.
 *
 * Why ts-jest (not jest-expo): SDK 56 / RN 0.85's jest-expo pulls a heavy native-mock surface and
 * needs babel-preset-expo (absent here). ts-jest transpiles the TS/TSX primitives directly, and the
 * native modules they import are mocked in tests/setup/* — enough to render to a host tree.
 *
 * This is a render smoke test, NOT a device run: layout, gestures, native animation, safe-area
 * insets and real keyboard behaviour still need a physical device (see docs/12_UIUX_AUDIT.md).
 */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.render.test.tsx'],
  // Primitives schedule timers on mount (Toast auto-dismiss, Skeleton/Orb breathing loops).
  // Fake timers let the test flush them deterministically inside act().
  fakeTimers: { enableGlobally: true },
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        diagnostics: false, // typecheck runs separately via `npm run typecheck`; keep the render test fast
        tsconfig: {
          jsx: 'react-jsx',
          esModuleInterop: true,
          allowJs: true,
          module: 'commonjs',
          moduleResolution: 'node',
          target: 'es2019',
          skipLibCheck: true,
          strict: false,
        },
      },
    ],
  },
  setupFiles: ['<rootDir>/tests/setup/render-mocks.ts'],
  moduleNameMapper: {
    // Map the heavy native deps the primitives import to lightweight host-component stubs.
    '^react-native$': '<rootDir>/tests/setup/mocks/react-native.tsx',
    '^react-native-svg$': '<rootDir>/tests/setup/mocks/react-native-svg.tsx',
    '^react-native-safe-area-context$': '<rootDir>/tests/setup/mocks/safe-area-context.tsx',
    '^@expo/vector-icons$': '<rootDir>/tests/setup/mocks/vector-icons.tsx',
  },
};
