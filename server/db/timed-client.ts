import type { Sql } from "postgres";

// Reports how long each query took, without changing what it returns. postgres.js queries are lazy
// Promises that start on then(), and drizzle calls .values() (which returns the same query) before
// awaiting, so timing from then() to settle covers pool wait, connecting and the query itself.
// Queries inside a transaction run on the transaction's own client and aren't timed
export function timeQueries<T extends Sql>(sql: T, onQuery: (ms: number) => void): T {
  type Settle = (value: unknown) => unknown;
  const unsafe = sql.unsafe.bind(sql) as (...args: unknown[]) => Promise<unknown>;
  (sql as { unsafe: unknown }).unsafe = (...args: unknown[]) => {
    const query = unsafe(...args);
    const then = query.then.bind(query) as (onFulfilled: Settle, onRejected: Settle) => Promise<unknown>;
    query.then = ((onFulfilled?: Settle, onRejected?: Settle) => {
      const start = performance.now();
      const done = () => onQuery(performance.now() - start);
      return then(
        (value) => {
          done();
          return onFulfilled ? onFulfilled(value) : value;
        },
        (error) => {
          done();
          if (onRejected) return onRejected(error);
          throw error;
        },
      );
    }) as typeof query.then;
    return query;
  };
  return sql;
}
