import EnvVars from '@src/constants/EnvVars';
import mariadb, { Pool } from 'mariadb';
import fs from 'fs';
import path from 'path';
import logger from 'jet-logger';

// database credentials
const { DBCred } = EnvVars;

// data interface
interface Data {
  keys: string[];
  values: unknown[];
}

// config interface
interface DatabaseConfig {
  host: string;
  user: string;
  password: string;
  database: string;
}

// database results interface
interface RowDataPacket {
  [columnName: string]: unknown;
}

interface ResultSetHeader {
  fieldCount: number;
  affectedRows: number;
  insertId: number;
  info: string;
  serverStatus: number;
  warningStatus: number;
}

// eslint-disable-next-line @typescript-eslint/ban-types
function processData(data: Object): Data {
  // get keys and values
  const keys = Object.keys(data);
  const values = Object.values(data);

  // remove id from keys and values
  const idIndex = keys.indexOf('id');
  if (idIndex > -1) {
    keys.splice(idIndex, 1);
    values.splice(idIndex, 1);
  }

  // if value is array or object stringify it
  for (let i = 0; i < values.length; i++) {
    if (Array.isArray(values[i])) {
      values[i] = `JSON-${JSON.stringify(values[i])}`;
    }
  }

  return { keys, values };
}

function parseResult<T>(result: RowDataPacket[] | ResultSetHeader)
  : T | undefined {

  if (result && Object.keys(result).length > 0) {
    const keys = Object.keys((result as RowDataPacket[])[0]);
    for (const element of keys) {
      const key = element;
      const value: unknown = (result as RowDataPacket[])[0][key];
      if (typeof value === 'string' && value.startsWith('JSON-')) {
        (result as RowDataPacket[])[0][key] =
          JSON.parse(value.replace('JSON-', ''));
      }
    }
  }

  let data: T | undefined = undefined;
  if (result) {
    data = (result as T[])?.[0] || undefined;
  }

  return data;
}

class Database {
  private static pool: Pool;
  private static isSetup = false;

  public constructor(config: DatabaseConfig = DBCred as DatabaseConfig) {
    if (!Database.pool) this.initialize(config);
  }

  public initialize(config: DatabaseConfig = DBCred as DatabaseConfig) {
    Database.pool = mariadb.createPool(config);
    this._setup();
  }

  public async insert(table: string, data: object): Promise<bigint> {
    const { keys, values } = processData(data);
    // create sql query - insert into table (keys) values (values)
    // ? for values to be replaced by params
    const sql = `INSERT INTO ${table} (${keys.join(',')})
                 VALUES (${values.map(() => '?').join(',')})`;
    // execute query
    const result = await this._query(sql, values);

    // return insert id
    let insertId = BigInt(-1);
    if (result) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      insertId = BigInt((result as ResultSetHeader)?.insertId);
    }
    return insertId;
  }

  public async update(table: string, id: bigint, data: object):
    Promise<boolean> {
    const { keys, values } = processData(data);

    // create sql query - update table set key = ?, key = ? where id = ?
    // ? for values to be replaced by params
    const sqlKeys = keys.map(key => `${key} = ?`).join(',');
    const sql = `UPDATE ${table}
                 SET ${sqlKeys}
                 WHERE id = ?`;
    // execute query
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result = await this._query(sql, [ ...values, id ]);

    let affectedRows = -1;
    if (result) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      affectedRows = (result as ResultSetHeader)?.affectedRows || -1;
    }

    // return true if affected rows > 0 else false
    return affectedRows > 0;
  }

  public async delete(table: string, id: bigint): Promise<boolean> {
    const sql = `DELETE
                 FROM ${table}
                 WHERE id = ?`;
    const result = await this._query(sql, [ id ]);

    let affectedRows = -1;
    if (result) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      affectedRows = (result as ResultSetHeader)?.affectedRows || -1;
    }

    // return true if affected rows > 0 else false
    return affectedRows > 0;
  }

  public async get<T>(table: string, id: bigint): Promise<T | undefined> {
    // create sql query - select * from table where id = ?
    const sql = `SELECT *
                 FROM ${table}
                 WHERE id = ?`;
    // execute query
    const result = await this._query(sql, [ id ]);

    // check if T has any properties that are JSON
    // if so parse them
    return parseResult<T>(result);
  }

  public async getObjByKey<T>(
    table: string,
    key: string,
    value: string | bigint,
  ): Promise<T | undefined> {
    // create sql query - select * from table where id = ?
    const sql = `SELECT *
                 FROM ${table}
                 WHERE ${key} = ?`;
    // execute query
    const result = await this._query(sql, [ value ]);

    // check if T has any properties that are JSON
    // if so parse them
    return parseResult<T>(result);
  }

  private async _setup() {
    // get setup.sql file
    let setupSql =
      fs.readFileSync(path.join(__dirname, '..', 'sql', 'setup.sql'), 'utf8');

    // remove comments
    setupSql = setupSql.replace(/--.*/g, '');

    // remove empty lines
    setupSql = setupSql.replace(/^\s*[\r, \n]/gm, '');

    // split sql queries
    const queries = setupSql.split(';');

    // get connection from pool
    const conn = await Database.pool.getConnection();

    try {
      // execute each query
      for (const query of queries) {
        if (query) await conn.query(query);
      }
    } catch (e) {
      logger.err(e);
    } finally {
      // release connection
      await conn.release();

      Database.isSetup = true;
    }
  }

  private async _query(sql: string, params?: unknown[]):
    Promise<ResultSetHeader | RowDataPacket[]> {
    while (!Database.isSetup)
      await new Promise(r => setTimeout(r, 100));
    if (!sql) return Promise.reject(new Error('No SQL query'));

    // get connection from pool
    const conn = await Database.pool.getConnection();
    try {
      // execute query and return result
      return await conn.query(sql, params);
    } finally {
      // release connection
      await conn.release();
    }
  }
}

export default Database;
