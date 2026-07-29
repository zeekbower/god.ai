# Security audit (2026-07-29)

A dependency and platform-version CVE audit of the three services this project runs,
done before any consideration of a public launch. Two kinds of findings below:
**dependency CVEs** (`npm audit`, production scope only — `--omit=dev`, since dev
tooling like eslint/mocha never ships to a live install) and **platform CVEs**
(known vulnerabilities in the specific pinned versions of NodeBB, Wiki.js, and
MongoDB themselves, found via direct research, not just `npm audit`).

## Platform versions — the headline findings

| Service | Version | Status |
|---|---|---|
| NodeBB | v4.14.2 | **Already patched.** This exact release (2026-07-23) shipped the final mitigations for 8 disclosed high-severity vulnerabilities (admin-panel access via homepage-setting redirect, 3 XSS issues including one via federated profile image URLs) found by Aikido Security's AI pentest review. No action needed — just don't downgrade. |
| Wiki.js | 2.5.314 | **Mostly patched, one unconfirmed.** CVE-2026-44224 (privilege escalation) is fixed as of 2.5.313, so we're covered. CVE-2025-56643 (JWT tokens stay valid after logout, affects 2.5.307) — couldn't independently confirm the exact fix version; 2.5.314 postdates the disclosure so it's likely included, but treat this as unconfirmed, not verified. |
| MongoDB | 7.0.14 | **Vulnerable, needs mitigation.** CVE-2025-14847: mismatched length fields in zlib-compressed wire protocol headers can allow arbitrary code execution, affects MongoDB 7.0.0-7.0.26. Real upgrade path is 7.0.28+; **immediate mitigation applied here: zlib compression disabled** on our mongod (see below) — MongoDB's own advisory lists this as a valid interim fix. |

## Dependency CVEs (npm audit, production scope only)

### god.ai (this repo's own site)
12 findings, all "high," **entirely eslint/build-tooling** (minimatch, brace-expansion,
@eslint/*) — these are devDependencies and never ship in a production build in the
first place (`npm run build` / `next build` doesn't bundle them into the deployed app).
Two runtime-relevant ones worth naming:
- **postcss** (`<=8.5.17`): XSS via unescaped `</style>` in stringified output, and
  path traversal via `sourceMappingURL` auto-loading. Tailwind runs postcss at build
  time, not on any runtime user input, so exposure here is low — no untrusted CSS is
  ever processed after deploy.
- **sharp** (`<0.35.0`): inherited libvips CVEs (image processing memory
  corruption). This repo doesn't call sharp directly, but Next.js's own image
  optimizer does — worth an eye if that feature gets used with user-uploaded images.

### NodeBB (forum) — production scope
8 findings, all "high," none critical: `lodash` (code injection via `_.template`,
prototype pollution via `_.unset`/`_.omit`), `js-beautify`/`editorconfig`/`glob`/
`minimatch`/`brace-expansion` (ReDoS-class, mostly reachable only through admin-side
tooling like the ACP code beautifier), and `nodebb-plugin-dbsearch` (same lodash
issue, one hop removed). None are critical-severity and none are trivially reachable
by an anonymous user, but they're real and worth tracking for NodeBB's own upstream
dependency bumps.

**Important scope note**: the *full* (dev-included) NodeBB audit shows 22 findings
including 2 critical (`request`'s SSRF, `form-data`'s CRLF injection) — both are
transitive dependencies of `mocha`/`coveralls` (NodeBB's own test suite), never
installed in production (`scripts/setup.sh` already uses `npm install --omit=dev`).
Confirmed this distinction directly rather than assuming it.

### Wiki.js — production scope
**113 findings: 16 critical, 49 high, 38 moderate, 10 low.** This is the real
finding of this audit — Wiki.js 2.x has been in slow/maintenance-only development for
years (a "Wiki.js 3" rewrite has been in progress a long time), and its dependency
tree has aged out significantly. Worst of the critical findings:
- **`simple-git` (≤3.35.2)** — remote code execution via option-parsing bypass, and a
  separate `blockUnsafeOperationsPlugin` bypass enabling RCE. Wiki.js uses this for
  its git-based storage/versioning integration.
- **`tar` (≤7.5.20)** — arbitrary file write/overwrite via hardlink and symlink path
  traversal, used during Wiki.js's own asset/backup handling.
- **`underscore` (≤1.13.7)** — arbitrary code execution, unlimited recursion DoS.
- **`graphql-tools` / `@graphql-tools/*` (old versions)** — RCE-class via
  `graphql-tag-pluck`'s `@babel/traverse` dependency (Babel arbitrary code execution
  when compiling crafted input) — relevant since Wiki.js's whole API surface is
  GraphQL.
- **`passport-saml`** — signature verification vulnerability (SAML auth bypass) —
  only relevant if SAML SSO is ever enabled, which it isn't in this project's config.
- **`express-brute`** — rate-limiting bypass, meaning Wiki.js's own brute-force
  protection on login can itself be bypassed.
- **`axios`** — a long list of SSRF/prototype-pollution/credential-leak CVEs across
  many historical advisories, all in the same aged `axios` pin.

**This is not a "run `npm audit fix --force`" situation.** Wiki.js pins these versions
deliberately for compatibility across its own (also aging) codebase; force-upgrading
transitive deps this deep risks breaking the app outright, and a proper fix means
waiting on/contributing to upstream Wiki.js dependency bumps, not patching around them
in `node_modules`. **Recommendation if this goes live: don't expose Wiki.js's admin
surface or SAML/OAuth integrations publicly without either (a) migrating to whatever
current Wiki.js release exists at launch time, or (b) putting it behind additional
network-level controls (VPN/IP allowlist for `/a` admin routes, WAF rules on the
GraphQL endpoint) — see AWS-HARDENING.md.**

## Mitigations applied now

- **MongoDB zlib compression disabled** (CVE-2025-14847 interim mitigation) — see
  `run.sh`/`scripts/setup.sh`'s mongod invocation, now starts with
  `--networkMessageCompressors none`.

## Recommendations if/when this goes live

1. **Upgrade MongoDB to 7.0.28+** (or the then-current patch release) before removing
   the zlib-disable mitigation.
2. **Re-run this audit close to launch**, not now — dependency CVEs get disclosed
   continuously; this snapshot is dated 2026-07-29.
3. **Wiki.js specifically needs the most attention** — either a version upgrade at
   launch time or the network-level containment described above. This is the single
   biggest gap found in this audit.
4. See `AWS-HARDENING.md` for infrastructure-level controls (network segmentation,
   secrets management, WAF) that reduce blast radius regardless of dependency state.
