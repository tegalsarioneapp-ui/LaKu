import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    log: {
      error: (...args: unknown[]) => void;
      info: (...args: unknown[]) => void;
      warn: (...args: unknown[]) => void;
      debug: (...args: unknown[]) => void;
    };
  }
}
