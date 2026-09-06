import type { ToolMeta } from '@/tools/_types';

export const meta: ToolMeta = {
  slug: 'sql-formatter',
  name: 'SQL Formatter',
  shortName: 'SQL Formatter',
  seoTitle: 'SQL Formatter Online — Free',
  tagline:
    'Beautify or minify SQL for 13 dialects, from PostgreSQL and MySQL to T-SQL, BigQuery and Snowflake.',
  description:
    'Free online SQL formatter and beautifier for PostgreSQL, MySQL, T-SQL, BigQuery, Snowflake and more. Indent, case and minify queries in your browser.',
  category: 'web',
  icon: 'database',
  keywords: [
    'sql formatter',
    'sql beautifier',
    'format sql online',
    'sql pretty print',
    'sql minifier',
    'postgresql formatter',
    'mysql query formatter',
    't-sql formatter',
    'bigquery sql formatter',
    'snowflake sql formatter',
    'sql indent',
    'sql query formatter online',
  ],
  intro: [
    'A query pasted out of application logs or an ORM arrives as one enormous line. This formatter breaks it back apart: keywords start their own clauses, joins and conditions line up, subqueries and CTEs are indented, and the result is something you can actually read in a code review.',
    'Thirteen dialects are supported — Standard SQL, MySQL, MariaDB, PostgreSQL, SQLite, SQL Server (T-SQL), BigQuery, Snowflake, Spark SQL, Oracle PL/SQL, Db2, Hive and Trino — so dialect-specific syntax such as T-SQL <code>TOP</code> or BigQuery arrays is parsed rather than mangled. You control keyword, data type and function case, the indent (2 spaces, 4 spaces or tabs) and the number of blank lines between statements. Minify does the opposite job: it collapses the query onto one line while leaving string literals and comments exactly as they were.',
    'Everything happens in your browser. The formatter is downloaded on demand the first time you use it and then keeps working offline, so queries containing table names, schema details or embedded values never leave your machine.',
  ],
  howTo: [
    'Pick the SQL dialect that matches your database.',
    'Paste your query into the SQL input pane, or press Sample to load an example.',
    'Choose Format to indent the query or Minify to collapse it onto one line.',
    'Set Keyword case, Data type case, Function case, Indent and Lines between queries to match your team style.',
    'Press Copy to take the result, or Download to save it as a .sql file.',
  ],
  example: {
    input: 'select id, name from users where active = true order by name',
    output: 'SELECT\n  id,\n  name\nFROM\n  users\nWHERE\n  active = TRUE\nORDER BY\n  name',
    note: 'Formatted as Standard SQL with upper-case keywords and a 2-space indent.',
  },
  faq: [
    {
      question: 'Which SQL dialects are supported?',
      answer:
        'Standard SQL, MySQL, MariaDB, PostgreSQL, SQLite, SQL Server (T-SQL), BigQuery, Snowflake, Spark SQL, Oracle PL/SQL, Db2, Hive and Trino. Choosing the right one matters: each dialect has its own keywords and quoting rules, so a query that fails to parse under one may format cleanly under another.',
    },
    {
      question: 'Does formatting change what my query does?',
      answer:
        'No. Only whitespace, line breaks and the letter case of keywords, data types and functions change — and case is only touched for the categories you switch away from Preserve. Identifiers, string literals and comments are left exactly as you wrote them.',
    },
    {
      question: 'What does Minify do to comments and strings?',
      answer:
        'Minify collapses runs of whitespace outside string literals and comments, and tightens the spacing around commas, semicolons and brackets. Text inside quotes is copied byte for byte, block comments are kept, and a <code>--</code> comment keeps the newline that ends it so the rest of the query is not commented out.',
    },
    {
      question: 'Why do I get a parse error on a valid query?',
      answer:
        'Usually because the dialect is wrong — vendor-specific syntax such as <code>TOP</code>, <code>MERGE</code> or array literals only parses under the dialect that defines it. Switch dialect first. If it still fails, the message points at the line and column where the parser stopped, which is normally an unclosed quote or bracket.',
    },
    {
      question: 'Can it format several statements at once?',
      answer:
        'Yes. Separate statements with semicolons and each one is formatted in turn. Use the Lines between queries option to put one or two blank lines between them.',
    },
    {
      question: 'Is my SQL uploaded anywhere?',
      answer:
        'No. The formatter is a static JavaScript file that runs in your tab, so queries with real table names or values stay on your machine. You can disconnect from the network once the page has loaded and the tool keeps working.',
    },
  ],
  related: ['code-formatter'],
  status: 'stable',
  added: '2026-09-07',
};
