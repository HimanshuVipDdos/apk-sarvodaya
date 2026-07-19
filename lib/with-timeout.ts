// Shared helper so no screen in the app can ever spin forever waiting on a
// slow/hanging request. Races the given promise against a timeout and
// rejects with a clean, user-facing message if it's too slow.
export function withTimeout<T>(p: PromiseLike<T>, ms = 10000): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Timed out. Check your connection and try again.")), ms)
    ),
  ]);
}
