declare module 'gamedig' {
  export interface QueryOptions {
    type: string
    host: string
    port?: number
    givenPortOnly?: boolean
    maxRetries?: number
    socketTimeout?: number
    attemptTimeout?: number
    requestPlayers?: boolean
  }

  export interface QueryResult {
    name?: string
    map?: string
    numplayers?: number
    maxplayers?: number
    players?: unknown[]
  }

  export class GameDig {
    static query(options: QueryOptions): Promise<QueryResult>
  }

  export const games: Record<string, unknown>
  export const protocols: Record<string, unknown>
}
