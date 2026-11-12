# Plan: Daily job-watcher (GitHub Actions)

## Goal
A small repo that runs daily on GitHub Actions (free), checks a configurable list of company job sites for roles whose **title** matches given keywords, and reports **new** matches since the last run. No paid services. No push/email notifications for now (results are read in the Actions run summary and in the repo).

## Decisions already made
- Language: **TypeScript on Node 20+**, Playwright only where needed.
- Schedule: daily at ~9am UK. GitHub cron is UTC and best-effort (runs can be late), so use `0 9 * * *` and accept a 1 hour shift in BST. Also add `workflow_dispatch` so it can be run manually.
- Keywords (case-insensitive, matched against job title): `QA`, `Test`, `Quality`.
  - `QA` and `Quality` match as whole words; `Test` matches as a prefix so "Tester" and "Testing" count. Put the patterns in config, not code.
  - These are broad. Support an optional `exclude` list in config (empty for now).
- Start with two sites; adding a third must be a config entry plus, at most, a small adapter.
- Prefer each site's **JSON job-search endpoint** over scraping rendered HTML. Fall back to Playwright only if no usable endpoint exists.

## Sites
1. **Capgemini UK**
   `https://www.capgemini.com/gb-en/careers/join-capgemini/job-search/?page=1&size=11&keyword=test&location=London&country_code=gb-en`
   - The page is JavaScript-rendered; a plain fetch returns only the page frame with no listings.
   - Find the underlying data request (browser devtools Network tab, filter Fetch/XHR) and call it directly if it works without cookies or tokens.
   - The URL's `keyword` param only takes one term, so run one query per keyword and de-duplicate, or fetch all London/UK results and filter locally. Paginate until exhausted.
   - If no clean endpoint exists, use Playwright, wait for the result list and read title, location and link.
2. **Ticketmaster / Live Nation (Workday)**
   `https://livenation.wd503.myworkdayjobs.com/en-US/TMExternalSite`
   - Standard Workday pattern, **unverified for this tenant**: `POST https://livenation.wd503.myworkdayjobs.com/wday/cxs/livenation/TMExternalSite/jobs` with body `{"appliedFacets":{},"limit":20,"offset":0,"searchText":"<keyword>"}`.
   - Paginate with `offset` until `total` is reached. Job link = site base URL + `externalPath`.
   - Confirm the exact request in devtools before relying on it. Optionally add a location filter via `appliedFacets` if UK-only is wanted (ask the user; default is no filter).

## Repo layout
```
.
├── .github/workflows/watch.yml
├── config.json              # sites, keywords, exclude list
├── src/
│   ├── index.ts             # orchestration
│   ├── match.ts             # keyword matching
│   ├── state.ts             # load/save seen jobs
│   ├── report.ts            # markdown summary
│   └── sites/
│       ├── capgemini.ts
│       └── workday.ts       # generic Workday adapter (tenant/host/site from config)
├── test/                    # unit tests with saved fixtures
├── data/
│   ├── seen.json            # committed state: { siteId: { jobId: {title, url, firstSeen} } }
│   └── latest.md            # most recent report, committed
├── package.json
└── README.md
```

## config.json shape
```json
{
  "keywords": ["QA", "Test", "Quality"],
  "exclude": [],
  "sites": [
    { "id": "capgemini-uk", "adapter": "capgemini", "url": "..." },
    { "id": "ticketmaster", "adapter": "workday",
      "host": "livenation.wd503.myworkdayjobs.com", "tenant": "livenation", "site": "TMExternalSite" }
  ]
}
```

## Behaviour
- Each adapter returns `{ id, title, location, url }[]` (stable `id` per job; use the site's own job id or requisition number, falling back to the URL).
- Filter by keyword and exclude rules on **title**.
- Compare with `data/seen.json`. New = not previously seen. Update state with everything seen this run (not just matches), so a job that later gains a matching title is still treated as new only once.
- **First run (empty state):** report all current matches once as "initial matches", then record them.
- Output: a markdown report to the GitHub Actions job summary (`$GITHUB_STEP_SUMMARY`) and to `data/latest.md`, grouped by site, with title, location and link. If there are no new matches, say so in one line.
- **Failure must never look like "no matches".** If a site errors, times out, or returns zero results when the last successful run saw some, mark that site FAILED in the report and exit non-zero so the workflow fails (GitHub emails the repo owner on failed workflows). Other sites still run and report.
- Be polite: identify with a normal User-Agent, small delays between paginated requests, retry transient errors (max 3, backoff), cap pages per site.
- Keep notification pluggable: if env var `NTFY_TOPIC` is set, also POST a short summary to `https://ntfy.sh/<topic>`. Not set by default.

## Workflow (`watch.yml`)
- Triggers: `schedule: cron "0 9 * * *"` and `workflow_dispatch`.
- `permissions: contents: write`; `concurrency` group so runs never overlap.
- Steps: checkout, setup-node 20 with npm cache, `npm ci`, install Playwright browsers **only if** a Playwright adapter is in use (`npx playwright install --with-deps chromium`), run `npm run watch`, then commit `data/` if changed with a `[skip ci]` message using the `github-actions[bot]` identity.
- Timeout 10 minutes.

## Testing
- Unit tests (Vitest) for keyword matching (word boundary, prefix, case, exclude) and state diffing (first run, new job, removed job, unchanged).
- Adapter tests against **saved JSON fixtures** captured from the real endpoints, so parsing is tested offline.
- A `--dry-run` flag that fetches and reports but does not write state, for local checking.
- Manually run the workflow once via `workflow_dispatch` and check the summary against the live sites in a browser.

## Order of work
1. Scaffold the repo, config loading, matching, state and report modules with tests.
2. Discover and verify the real data requests for both sites (devtools); save fixtures.
3. Implement the Workday adapter, then the Capgemini adapter (Playwright only if no usable endpoint).
4. Add the workflow, run it manually, fix whatever differs on GitHub's runners (e.g. bot blocking from datacentre IPs).
5. Write the README: how to add a site, change keywords, trigger a run, re-enable the schedule.

## Risks and notes
- GitHub may pause scheduled workflows after ~60 days of repo inactivity. The README should say how to re-enable; do not rely on bot commits keeping it alive.
- Datacentre IPs may be treated differently from a home connection. If Capgemini blocks GitHub runners, report it as a FAILED site; do not add evasion or CAPTCHA workarounds.
- Use a **private** repo (2,000 free Actions minutes/month; a daily run needs a few minutes). It contains no personal data or secrets.
- Respect each site's terms and robots.txt; keep request volume low.

## Acceptance criteria
- A manual run on GitHub completes in under ~5 minutes and lists matching roles from both sites with working links.
- A second run immediately after reports no new matches.
- Breaking a site URL in config makes that site show as FAILED and the workflow fail.
- Adding a third Workday site requires only a config entry.
