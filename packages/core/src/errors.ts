/**
 * Thrown by every real adapter that is still a stub. The message carries a
 * `TODO(<integration>)` marker so unfinished seams are greppable.
 */
export class NotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotImplementedError";
    // Restore prototype chain for instanceof across compiled targets.
    Object.setPrototypeOf(this, NotImplementedError.prototype);
  }
}
