export class DatabaseConfigError extends Error {
  constructor(message = "Database is not configured") {
    super(message);
    this.name = "DatabaseConfigError";
  }
}

export function isDatabaseConfigError(error: unknown): error is DatabaseConfigError {
  return error instanceof DatabaseConfigError;
}
