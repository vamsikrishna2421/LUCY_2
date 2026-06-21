/**
 * Jest setup for the design-system render smoke test.
 * react-test-renderer's act() needs this global flag under React 19.
 */
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
