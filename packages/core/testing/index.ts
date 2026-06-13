/**
 * Contract-test suites — the mechanism that makes the modules independent.
 *
 * For each port there is ONE parametrized suite here. A module's mock adapter
 * runs it today; its real adapter runs the SAME suite later. "Is the mock
 * right?" and "is the real adapter right?" become the same question, answered
 * by the same code — so each adapter can be built and proven in isolation.
 */
export * from "./contracts/resolver.contract";
export * from "./contracts/fetcher.contract";
export * from "./contracts/signer.contract";
export * from "./contracts/review.contract";
export * from "./contracts/verdict.contract";
export * from "./contracts/watcher.contract";
