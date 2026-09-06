import { describe, expect, it } from 'vitest';

import {
  byteLength,
  dialectLabel,
  DIALECTS,
  fileNameFor,
  formatSql,
  formatterConfig,
  isDialectId,
  isReady,
  minifySql,
  normalizeSql,
  SAMPLE,
  savingsPercent,
  splitSql,
  SqlFormatError,
  toSqlError,
} from './logic';

/** Await a promise that must reject, and hand back the rejection value typed. */
async function rejection<T>(promise: Promise<unknown>): Promise<T> {
  try {
    await promise;
  } catch (err) {
    return err as T;
  }
  throw new Error('expected the promise to reject');
}

describe('dialects', () => {
  it('offers the thirteen supported dialects', () => {
    expect(DIALECTS.map((d) => d.id)).toEqual([
      'sql',
      'mysql',
      'mariadb',
      'postgresql',
      'sqlite',
      'tsql',
      'bigquery',
      'snowflake',
      'spark',
      'plsql',
      'db2',
      'hive',
      'trino',
    ]);
  });

  it('recognises dialect ids and labels them', () => {
    expect(isDialectId('postgresql')).toBe(true);
    expect(isDialectId('oracle')).toBe(false);
    expect(dialectLabel('tsql')).toBe('SQL Server (T-SQL)');
    expect(dialectLabel('sql')).toBe('Standard SQL');
  });

  it('names downloads per mode', () => {
    expect(fileNameFor('format')).toBe('query.sql');
    expect(fileNameFor('minify')).toBe('query.min.sql');
  });
});

describe('normalizeSql, byteLength and savingsPercent', () => {
  it('strips a BOM and normalises line endings', () => {
    expect(normalizeSql('﻿SELECT 1\r\nFROM t\rWHERE x')).toBe('SELECT 1\nFROM t\nWHERE x');
  });

  it('counts UTF-8 bytes and byte savings', () => {
    expect(byteLength('SELECT 1')).toBe(8);
    expect(byteLength('naïve')).toBe(6);
    expect(savingsPercent(200, 50)).toBe(75);
    expect(savingsPercent(0, 0)).toBe(0);
  });
});

describe('formatterConfig', () => {
  it('defaults to standard SQL, upper-case keywords and two spaces', () => {
    expect(formatterConfig()).toEqual({
      language: 'sql',
      keywordCase: 'upper',
      dataTypeCase: 'preserve',
      functionCase: 'preserve',
      tabWidth: 2,
      useTabs: false,
      linesBetweenQueries: 1,
    });
  });

  it('maps every option, including tab indentation', () => {
    expect(
      formatterConfig({
        dialect: 'postgresql',
        keywordCase: 'lower',
        dataTypeCase: 'upper',
        functionCase: 'lower',
        indent: 'tab',
        linesBetweenQueries: 2,
      }),
    ).toEqual({
      language: 'postgresql',
      keywordCase: 'lower',
      dataTypeCase: 'upper',
      functionCase: 'lower',
      tabWidth: 2,
      useTabs: true,
      linesBetweenQueries: 2,
    });
    expect(formatterConfig({ indent: 4 }).tabWidth).toBe(4);
  });
});

describe('splitSql', () => {
  it('separates code from string literals', () => {
    expect(splitSql("SELECT 'a  b' FROM t")).toEqual([
      { code: true, text: 'SELECT ' },
      { code: false, text: "'a  b'" },
      { code: true, text: ' FROM t' },
    ]);
  });

  it('treats line comments as verbatim and re-adds their newline', () => {
    expect(splitSql('SELECT 1 -- note\nFROM t')).toEqual([
      { code: true, text: 'SELECT 1 ' },
      { code: false, text: '-- note\n' },
      { code: true, text: 'FROM t' },
    ]);
  });
});

describe('minifySql', () => {
  it('collapses whitespace and newlines', () => {
    expect(minifySql('SELECT   a\n  FROM     t\n  WHERE  x = 1')).toBe(
      'SELECT a FROM t WHERE x = 1',
    );
  });

  it('tightens spacing around commas, semicolons and brackets', () => {
    expect(minifySql('SELECT a , b FROM t WHERE id IN ( 1 , 2 ) ;')).toBe(
      'SELECT a,b FROM t WHERE id IN (1,2);',
    );
  });

  it('never touches whitespace inside string literals', () => {
    expect(minifySql("SELECT   'a   b' ,  'c'  FROM t")).toBe("SELECT 'a   b','c' FROM t");
  });

  it('handles doubled and backslash-escaped quotes', () => {
    expect(minifySql("SELECT   'it''s   fine'")).toBe("SELECT 'it''s   fine'");
    expect(minifySql("SELECT   'a\\'  b'")).toBe("SELECT 'a\\'  b'");
  });

  it('preserves quoted identifiers in double quotes and backticks', () => {
    expect(minifySql('SELECT  "my  col" ,  `other  col`  FROM t')).toBe(
      'SELECT "my  col",`other  col` FROM t',
    );
  });

  it('keeps comments and the newline that terminates a line comment', () => {
    expect(minifySql('SELECT 1  -- keep   this\nFROM   t')).toBe('SELECT 1 -- keep   this\nFROM t');
    expect(minifySql('SELECT 1  # mysql   style\nFROM   t')).toBe(
      'SELECT 1 # mysql   style\nFROM t',
    );
    expect(minifySql('SELECT /*  block  */   1')).toBe('SELECT /*  block  */ 1');
  });

  it('survives unterminated quotes and comments', () => {
    expect(minifySql("SELECT   'unclosed")).toBe("SELECT 'unclosed");
    expect(minifySql('SELECT /* unclosed')).toBe('SELECT /* unclosed');
  });

  it('returns an empty string for blank input and shrinks the sample', () => {
    expect(minifySql('')).toBe('');
    expect(minifySql('   \n\t ')).toBe('');
    expect(byteLength(minifySql(SAMPLE))).toBeLessThanOrEqual(byteLength(SAMPLE));
  });
});

describe('toSqlError', () => {
  it('shortens an unexpected-token message and keeps the position', () => {
    const error = toSqlError(
      new Error('Parse error: Unexpected "\'oops" at line 2 column 8. SQL dialect used: "sql".'),
      'SELECT 1\nFROM t',
    );
    expect(error).toBeInstanceOf(SqlFormatError);
    expect(error.message).toBe(
      'SQL parse error: unexpected "\'oops" at line 2, column 8. Check for an unclosed quote or bracket, a missing comma, or try a different SQL dialect.',
    );
    expect(error.position).toMatchObject({ line: 2, column: 8 });
  });

  it('explains an unexpected end of statement', () => {
    const error = toSqlError(
      new Error('Parse error at token: «EOF» at line 1 column 29 Unexpected EOF token: {...}'),
      'SELECT * FROM t WHERE (a = 1',
    );
    expect(error.message).toContain('the statement ends before it is finished');
    expect(error.position?.line).toBe(1);
  });

  it('handles an unsupported dialect and messages without a position', () => {
    expect(toSqlError(new Error('Unsupported SQL dialect: nope'), '').message).toBe(
      'That SQL dialect is not supported. Pick another one.',
    );
    const generic = toSqlError(new Error('something odd happened'), 'SELECT 1');
    expect(generic.message).toContain('the query could not be parsed');
    expect(generic.position).toBeUndefined();
  });

  it('passes an existing SqlFormatError through untouched', () => {
    const original = new SqlFormatError('already wrapped');
    expect(toSqlError(original, '')).toBe(original);
  });
});

describe('formatSql (library loaded on demand)', () => {
  it('formats a query and upper-cases keywords by default', async () => {
    expect(await formatSql('select a,b from t where x=1')).toBe(
      'SELECT\n  a,\n  b\nFROM\n  t\nWHERE\n  x = 1',
    );
  });

  it('honours keyword case, indent and dialect', async () => {
    expect(await formatSql('SELECT a FROM t', { keywordCase: 'lower' })).toContain('select');
    expect(await formatSql('SELECT a FROM t', { indent: 4 })).toContain('\n    a');
    expect(await formatSql('SELECT a FROM t', { indent: 'tab' })).toContain('\n\ta');
    expect(await formatSql('SELECT TOP 1 a FROM t', { dialect: 'tsql' })).toContain('TOP');
  });

  it('applies data type and function case', async () => {
    const out = await formatSql('select count(a) from t where cast(b as varchar) = 1', {
      dataTypeCase: 'upper',
      functionCase: 'upper',
    });
    expect(out).toContain('COUNT(');
    expect(out).toContain('VARCHAR');
  });

  it('puts the configured number of blank lines between queries', async () => {
    const one = await formatSql('SELECT 1; SELECT 2;', { linesBetweenQueries: 1 });
    const two = await formatSql('SELECT 1; SELECT 2;', { linesBetweenQueries: 2 });
    expect(two.split('\n').length).toBeGreaterThan(one.split('\n').length);
  });

  it('formats the sample into a multi-line query', async () => {
    const out = await formatSql(SAMPLE, { dialect: 'postgresql' });
    expect(out).toContain('WITH');
    expect(out).toContain('INNER JOIN');
    expect(out.split('\n').length).toBeGreaterThan(20);
  });

  it('returns an empty string for blank input', async () => {
    expect(await formatSql('  \n ')).toBe('');
  });

  it('reports a parse error with a position and a hint', async () => {
    const error = await rejection<SqlFormatError>(
      formatSql("SELECT ' unclosed", { dialect: 'postgresql' }),
    );
    expect(error).toBeInstanceOf(SqlFormatError);
    expect(error.message).toContain('SQL parse error');
    expect(error.message).toContain('try a different SQL dialect');
    expect(error.position?.line).toBe(1);
  });

  it('reports the library as loaded after the first format', () => {
    expect(isReady()).toBe(true);
  });
});
