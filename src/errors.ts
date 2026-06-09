// Error hierarchy. Keep this small — three classes cover every failure
// mode we care about for v0.1. Customers can `instanceof` to branch on
// recoverable vs not.

export class NetworkTestsError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "NetworkTestsError";
    this.code = code;
  }
}

/** Raised when the caller's AbortSignal fires. */
export class AbortError extends NetworkTestsError {
  constructor(message = "Operation aborted") {
    super("ABORTED", message);
    this.name = "AbortError";
  }
}

/** Raised when a hard timeout fires before the test completes. */
export class TimeoutError extends NetworkTestsError {
  constructor(message = "Operation timed out") {
    super("TIMEOUT", message);
    this.name = "TimeoutError";
  }
}
