import type { ToolMeta } from '@/tools/_types';

export const meta: ToolMeta = {
  slug: 'cron-parser',
  name: 'Cron Expression Parser',
  shortName: 'Cron Parser',
  seoTitle: 'Cron Expression Parser & Next Run Times',
  tagline: 'Translate a cron expression into plain English and see its next 10 run times.',
  description:
    'Free online cron expression parser. Turn any 5- or 6-field crontab schedule into plain English, see the next 10 run times in any time zone, in your browser.',
  category: 'web',
  icon: 'clock',
  keywords: [
    'cron expression parser',
    'crontab generator',
    'cron schedule explained',
    'cron next run time',
    'cron to english',
    'cron syntax checker',
    'crontab validator',
    'every 15 minutes cron',
    'cron time zone',
  ],
  intro: [
    'Cron syntax is five terse fields — minute, hour, day of month, month, day of week — and one wrong character quietly changes when your job runs. Paste an expression here and it is described in plain English, broken down field by field, and turned into the next ten concrete run times so you can check the schedule against the clock instead of against your memory of the format.',
    'The parser accepts the 6-field form with leading seconds used by Quartz, Kubernetes-style schedules and many job runners, plus the @daily, @hourly and @weekly shorthands. Run times are computed in the time zone you pick — Local, UTC or any common IANA zone — and shown next to UTC, which is what most schedulers actually use. Invalid expressions get a specific message instead of a silent empty table.',
    'Nothing is sent anywhere. The description comes from cronstrue and the run times from croner, both running in your browser, so an internal schedule from a private repository stays on your machine.',
  ],
  howTo: [
    'Type or paste a cron expression, or click one of the preset buttons.',
    'Read the plain-English description and the field breakdown underneath it.',
    'Pick a time zone to see the next 10 run times in that zone alongside UTC.',
    'Use Copy expression or Copy next runs to take the result with you.',
  ],
  example: {
    input: '0 9 * * 1-5',
    output: 'At 09:00, Monday through Friday',
    note: 'Add a sixth leading field for seconds — “30 0 9 * * 1-5” fires at 09:00:30 on weekdays.',
  },
  faq: [
    {
      question: 'What do the five fields in a cron expression mean?',
      answer:
        'In order: minute (0–59), hour (0–23), day of month (1–31), month (1–12 or JAN–DEC) and day of week (0–7 or SUN–SAT, where both 0 and 7 mean Sunday). A sixth field, if present, goes in front and means seconds. The breakdown table on this page labels each one for the expression you typed.',
    },
    {
      question: 'How do I write a cron job that runs every 15 minutes?',
      answer:
        'Use <code>*/15 * * * *</code>. The <code>*/15</code> step means “every 15th minute”, so it fires at :00, :15, :30 and :45 of every hour. The Every 15 minutes preset button fills it in for you.',
    },
    {
      question: 'What time zone does cron use?',
      answer:
        'Classic crontab uses the server’s local time zone, while most managed schedulers default to UTC — which is why a job can appear to run “an hour early” after a daylight-saving change. Pick the zone your scheduler uses in the Time zone select; the table always shows UTC alongside it for comparison.',
    },
    {
      question: 'Why do day-of-month and day-of-week together behave oddly?',
      answer:
        'In standard cron, when both fields are restricted the job runs if <strong>either</strong> matches, not both. So <code>0 0 13 * 5</code> runs on the 13th of every month <em>and</em> on every Friday. Keep one of the two as <code>*</code> unless you really want that behaviour.',
    },
    {
      question: 'Does this support @daily and other shorthands?',
      answer:
        'Yes. <code>@yearly</code>, <code>@annually</code>, <code>@monthly</code>, <code>@weekly</code>, <code>@daily</code>, <code>@midnight</code> and <code>@hourly</code> are expanded to their 5-field equivalents before parsing, so you can see exactly what they mean.',
    },
    {
      question: 'Is my cron expression uploaded anywhere?',
      answer:
        'No. Parsing, describing and calculating the next run times all happen in your browser. Nothing is logged or stored, and the page keeps working offline once loaded.',
    },
  ],
  related: ['timestamp-converter'],
  status: 'stable',
  added: '2026-09-07',
};
