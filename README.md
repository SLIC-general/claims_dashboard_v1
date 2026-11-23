# SLIC Motor Claims Dashboard

Serve this folder over HTTP and open `index.html`. It also works directly from a `file://` URL using the generated local-data fallback. Screens ≤ 700px wide get the mobile app layout (`mobile.js`, `mobile.css`).

## Hierarchy

Zone (Senior Engineer) → Region (Regional Engineer) → Branch → Technical Officer, under the AGM – Technical and the Deputy Chief Motor Engineer.

- 4 zones (Central, North, South, Western) and the Spare Parts Unit (island-wide, no regions)
- 14 region records (Colombo South counts as 2 regions: CS 01 and CS 02), 89 branches (BR-001 … BR-089), 162 Technical Officers

The master source is `data/source/operational-chain.js` (Island Operational Chain – Technical officer List 2026).

## Files

- `index.html`, `styles.css`, `app.js`: desktop dashboard, filters, calculations and rendering.
- `mobile.js`, `mobile.css`: mobile app shell.
- `auth.js`, `auth.css`: sign-in screen, session and role-based access.
- `data.json`: dataset paths, thresholds and the sign-in settings (`auth`).
- `data/organisation.json`: `zones` (with `seniorEngineerId`), `regions` (with `engineerIds`), `branches` (with `regionId`, `zoneId`).
- `data/users.json`: every user — EPF, TO code, name, mobile, role, title and scope (`zoneId`, `regionIds`, `branchId`).
- `data/roles.json`: what each role can see (see below).
- `data/<category>.json`, `data/alerts.json`: branch-level monthly records with `zoneId`, `regionId`, `branchId`.
- `data/local-fallback.js`: generated bundle used only for `file://` access.
- `tools/build-org.cjs`: rebuilds organisation, users and roles from the source and regenerates the fallback bundle.

## Signing in

Users sign in with their **EPF number** and the **common password** (default `Slic@2026`).
Users without an EPF yet sign in with their `loginId` (for example `AGM`, `DCME`, `SE-CEN`, `RE-01`) until the EPF is added to `users.json`.

To change the common password, put the SHA-256 of the new password in `data.json` → `auth.commonPasswordSha256`:

```
node -e "console.log(require('crypto').createHash('sha256').update('NewPassword').digest('hex'))"
```

Then regenerate the fallback bundle (`node tools/build-org.cjs`). Sessions last `auth.sessionHours` (default 12).

> The sign-in runs in the browser. It controls what the dashboard shows, but anyone with the files can read the JSON data. Before the dashboard is exposed beyond the internal network, move sign-in and data filtering to a server.

## Roles and access (`data/roles.json`)

| Role | Scope | Branch breakdown | Other branches |
|---|---|---|---|
| ADMIN, AGM, DCME, VIEWER | Island | All | — |
| SENIOR_ENGINEER | Own zone (Spare Parts Unit: island) | Own zone | Totals and rankings |
| REGIONAL_ENGINEER | Own region(s) | Own region(s) | Totals and rankings |
| TO | Own branch | Own branch | Totals and rankings |

- `scope` decides where the user lands after sign-in and after **Clear**.
- `branchDetail: own` blocks opening technical officers / officer profiles / the branch register of branches outside scope (shown with a 🔒).
- `otherBranches: hidden` removes other branches from rankings entirely.
- `screens` lists the parts a role can open (`home`, `zones`, `branches`, `alerts`, `search`, `officerContacts`).
- Scoped users see a **Your branch / region / zone** card with their island rank, rank within their zone and the gap to the island rate.

## Adding or updating users

Edit `data/users.json`:

```json
{ "id": "VW-01", "epf": "40001", "toCode": "", "name": "Mr. Example", "mobile": "07XXXXXXXX",
  "role": "VIEWER", "title": "Manager – Motor", "zoneId": null, "regionIds": [], "branchId": null, "loginId": "", "active": true }
```

- High-level users: `VIEWER`, `DCME`, `AGM` or `ADMIN` (island-wide).
- Zone users: `SENIOR_ENGINEER` with `zoneId` (`CEN`, `NOR`, `SOU`, `WES`, `SPU`).
- Region users: `REGIONAL_ENGINEER` with `regionIds` (e.g. `["GAL", "KAL"]`).
- Technical officers: `TO` with `branchId`.
- Set `"active": false` to block sign-in.

Then run `node tools/build-org.cjs`. It keeps existing EPF, mobile, role, title and `active` values, and keeps users that are not in the source list.

## Data sources

`tools/import-engineering.cjs` imports five categories from the Engineering Dashboard 2026 HTML, then `tools/build-org.cjs` regenerates the fallback bundle:

```
node tools/import-engineering.cjs "C:\path\SLIC Motor Claims Engineering Dashboard.html"
node tools/build-org.cjs
```

| Category | Source in the Engineering Dashboard | Periods | Level |
|---|---|---|---|
| Bee Express | Individual TO performance (entitled / successful) | Jan–Oct 2026 | Branch (TO records summed) |
| Video Inspection | VI team officers' Bee Express claims / offers (48 officers) | Jan–Oct 2026 | Branch |
| SA Pending | TO-wise SA outstanding, latest daily snapshot of each month | May (27th), Jun (3rd) 2026 | Branch |
| Cash in Lieu | Engineer-wise claims, offer amount and saving | Jan–Jun 2026 | Region main branch |
| Claim Ratio | Island ratio trend and Net Premium report | Jan–May 2026 (premium Jan–Mar) | All Island only |

Records are matched to branches by branch name first, then by TO code or officer name in `users.json`.

- **Bee Express** totals are within 0.5% of the report's All Island figures. The gap comes from TOs who are not in the 2026 chain, such as Kaduruwela (TO 15).
- **SA Pending** is a snapshot. The yearly view shows the latest snapshot, not a sum. Branches are ranked by pending jobs, not by a rate. One entry (TO 60, 2 jobs) was not matched.
- **Cash in Lieu** has no branch split in the source, so each engineer's figures are attributed to their region's main branch (Head Office for HO engineers). Mendis → Badulla and Rashmi → Ratnapura are inferred. Claim counts match the report's All Island row. Engineer offer amounts do not match it in May and June, because the source rows don't add up to its own totals.
- **Claim Ratio** is shown only for All Island with no zone or branch filter. The source's zone ratios use the old five-zone structure, so they were not imported.

Spare Parts, Pending Consistency, Special Offers, Document Tracking and the alerts are still sample data for June 2026 only. TO Errors is not in any feed. The Engineering Dashboard's consistency table and branch claim ratios are sample data, so they were not imported.

**Daily view.** The feeds are monthly, so the Daily option spreads each month's records over its days. Weekdays get more, Saturdays less, Sundays very little. The split is fixed, so a day always shows the same figures, and rates stay close to the month's rate. SA Pending shows the month's snapshot, Claim Ratio shows the month's ratio, and each alert is assigned to one day of its month. Rankings need only 1 claim per branch in this view. Replace this with real daily records when a daily feed is available.

Officer-level figures, Claim Ratio inputs and TO error records are not in the data feed; these show `—` or an explanatory empty state.
