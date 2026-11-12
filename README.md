# Job watcher

Runs daily on GitHub Actions, checks company job sites for roles whose **title** matches your keywords, and reports the ones it hasn't seen before. No paid services, no notifications: check the **Actions** tab (run summary) or `data/latest.md`.

## How it works
- `config.json` lists keywords and sites. Each site has an `adapter` (`workday` or `capgemini`) that fetches **all** jobs from the site's JSON API; matching is done locally on the title (the sites' own search also matches descriptions).
- `data/seen.json` remembers every job seen. New matching jobs are reported once.
- The very first run reports all current matches as "Initial matches".
- If a site errors, or suddenly returns 0 jobs after having had some, it is marked **FAILED** in the report and the run fails (GitHub emails you about failed runs). Other sites still report.

## Keywords
In `config.json`:
```json
"keywords": ["QA", "Test*", "Quality"],
"exclude": []
```
Case-insensitive, matched against the title. `QA` matches the whole word only; a trailing `*` means prefix (`Test*` matches Test, Tester, Testing). `exclude` uses the same syntax and removes matches (e.g. `["Intern", "Manager"]`).

## Add a site
- **Another Workday site:** add a config entry only. Take the three parts from its URL `https://<host>/en-US/<site>` (tenant is the first part of `<host>`):
  ```json
  { "id": "acme", "adapter": "workday", "host": "acme.wd1.myworkdayjobs.com", "tenant": "acme", "site": "AcmeCareers" }
  ```
  Optional `"appliedFacets": {...}` to filter (e.g. by location) using Workday's facet ids.
- **Capgemini:** `country_code` is `gb-en` for the UK. Optional `"locations": ["London"]` keeps only jobs whose location text contains one of the strings (default: all UK jobs).
- **Anything else:** write an adapter in `src/sites/` (a function returning `{ id, title, location, url }[]`) and register it in `src/sites/index.ts`.

## Run it
```
npm ci
npm run watch -- --dry-run   # fetch and report, write nothing
npm run watch                # also updates data/seen.json and data/latest.md
npm test
```
On GitHub: **Actions → Job watcher → Run workflow** to trigger manually. The schedule is `0 9 * * *` UTC (10am in summer UK time) and GitHub may run it late.

## Setup
1. Create a **private** GitHub repo and push this folder.
2. Settings → Actions → General → Workflow permissions: allow read and write (the workflow also declares `contents: write`).
3. Run the workflow once manually and check the summary.

## If it stops running
GitHub disables scheduled workflows after ~60 days without repo activity. Re-enable under **Actions → Job watcher → Enable workflow** (or push any commit). Bot commits from the workflow do not count.

If Capgemini or Workday starts blocking GitHub's servers, the site shows as FAILED; there is deliberately no evasion logic.
