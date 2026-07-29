# Hardening for an AWS deployment

Written after `SECURITY.md`'s dependency/CVE audit — several of these controls exist
specifically because of what that audit found, not as generic boilerplate. Read that
file first; this one is about containing the blast radius of what it turned up,
since several of those issues (Wiki.js's aged dependency tree especially) won't be
fully resolved by launch time.

None of this is provisioned yet — it requires an actual AWS account, which this
environment doesn't have access to. This is the concrete plan to implement, and
`scripts/setup-aws.sh` is the install-time half of it (OS/instance-level hardening
that script *does* apply). The infrastructure half (VPC, ALB, WAF, IAM) has to be
provisioned through the AWS console/CLI/Terraform by whoever holds the account.

## Why IMDSv2 specifically matters here

**This is the single highest-leverage control given what the CVE audit found.**
Wiki.js's dependency tree includes a long list of `axios` SSRF advisories. If any of
those are ever reachable from user input (a webhook URL, an OAuth callback, a
git/storage integration), an attacker can potentially make the *server* issue a
request to `169.254.169.254` — the EC2 instance metadata service. With IMDSv1
enabled, that request needs no authentication and hands back the instance's IAM
credentials directly, turning an application-layer SSRF into full AWS account
compromise. **Enforce IMDSv2 (session-token-required) on every instance** — this
alone defangs the entire class of SSRF findings from the audit at the infrastructure
level, independent of whether every affected npm package ever gets patched.

```
aws ec2 modify-instance-metadata-options \
  --instance-id <id> --http-tokens required --http-endpoint enabled
```

## Network architecture

- **VPC with public + private subnets.** Only the load balancer sits in a public
  subnet. NodeBB, Wiki.js, MongoDB, and the Next.js site all run in private subnets
  with no direct internet route — outbound-only via a NAT gateway for package
  installs/updates.
- **Security groups, not broad CIDR rules.** ALB security group: 443 from `0.0.0.0/0`
  (443 only — no plain 80 except a redirect listener). App-tier security group:
  inbound only from the ALB's security group, not from the internet or even the whole
  VPC CIDR. MongoDB's security group: inbound only from the app tier's security group,
  on 27117, nothing else, ever.
- **No SSH port open to the internet.** Use **SSM Session Manager** for shell access
  instead of a bastion host or open port 22 — no inbound rule needed at all, and every
  session is logged centrally in CloudWatch.

## TLS

- **ACM certificate on the ALB**, not on the app instances — termination happens at
  the load balancer, traffic from ALB to app tier can stay HTTP inside the private
  subnet (or re-encrypt if you want defense in depth, but it's not the weak point).
- **HTTP→HTTPS redirect** at the ALB listener level, plus `Strict-Transport-Security`
  header (NodeBB already sends most of the right security headers by default — verify
  HSTS specifically is included in what actually reaches the browser through the ALB).
- Update `forum/config.json`'s `"url"` and `wiki/config.yml`'s equivalent to the real
  `https://` domain once one exists — both currently point at `http://` LAN addresses
  from local development.

## IAM

- **No long-lived access keys on any instance.** Every EC2 instance gets an IAM
  **instance role**, scoped to exactly what that instance needs (e.g., the app tier's
  role can read specific Secrets Manager secrets and write to a specific S3 backup
  bucket — nothing else, no `*` resource ARNs).
- **Separate roles per tier** (site, NodeBB, Wiki.js) rather than one shared role, so
  a compromise of one service doesn't inherit another's permissions.

## Secrets

- **AWS Secrets Manager**, not the plaintext `.env.local` / `bots/*.env` files this
  project currently uses in local dev. At minimum: NodeBB's session `secret` (in
  `forum/config.json`), the Wiki.js admin API key, and every bot's NodeBB password.
- Rotate NodeBB's `secret` value before launch — the one currently in
  `forum/config.json` was generated for local dev and has been sitting in a
  non-production environment; treat it as burned.
- If instances need these at boot, pull them via the instance role at startup
  (`aws secretsmanager get-secret-value`), don't bake them into an AMI or user-data
  script in plaintext.

## Database

- **Prefer Amazon DocumentDB** (MongoDB-API-compatible) over self-managed MongoDB on
  EC2 if the team doesn't want to own patching — it would have sidestepped
  CVE-2025-14847 (the zlib compression issue from `SECURITY.md`) entirely, since AWS
  handles engine patching. If staying self-managed on EC2 instead: **enable EBS
  encryption at rest** on the data volume, and keep the `--networkMessageCompressors`
  mitigation applied here until the engine itself is upgraded past 7.0.28.
- Either way: database security group allows inbound *only* from the app tier, never
  from a bastion, never `0.0.0.0/0`.

## WAF — especially for Wiki.js

Given `SECURITY.md`'s finding that Wiki.js's GraphQL/admin surface carries the most
outstanding risk of the three services: put **AWS WAF** in front of the ALB with, at
minimum, the AWS Managed Rules **Core rule set** and **Known bad inputs** rule groups
active, plus a **rate-based rule** on the login and GraphQL endpoints specifically.
If Wiki.js's admin routes (`/a/*`) don't need to be public, restrict them via a
WAF IP-set rule to a known office/VPN range rather than relying on Wiki.js's own
(recently-patched, but still worth defense-in-depth) auth logic alone.

## Logging & monitoring

- **CloudWatch Logs** for NodeBB, Wiki.js, and mongod output (all three currently log
  to local files only — `forum-data/mongo-startup.log`, NodeBB's own log path, etc.)
  — ship these via the CloudWatch agent instead of leaving them local-only.
- **VPC Flow Logs** enabled on the VPC.
- **GuardDuty** enabled account-wide — its EC2/S3 threat detection would specifically
  flag anomalous instance-metadata-service access patterns, which ties directly back
  to the IMDSv2 point above as a second layer of defense.
- **AWS Config + Security Hub**, using the **AWS Foundational Security Best
  Practices** standard, for continuous drift detection against everything in this
  document rather than a one-time setup that silently rots.

## Backups

- Automated **EBS snapshots** (via Data Lifecycle Manager) for the MongoDB data
  volume, on a real retention schedule (daily, 7-day rolling minimum).
- Wiki.js's SQLite database and uploaded assets, and the bot framework's `.env`
  credential files, backed up to a **versioned, encrypted S3 bucket** with a lifecycle
  policy — not left as the only copy on a single EC2 root volume.

## Patch cadence

- **SSM Patch Manager** (or an equivalent scheduled process) for OS-level patches on
  every instance.
- Re-run `SECURITY.md`'s audit close to actual launch, and again on a recurring
  cadence after — it's a snapshot dated 2026-07-29, not a permanent clearance.
- Track Wiki.js's own upstream releases specifically — see `SECURITY.md`'s note that
  its dependency tree is the biggest outstanding gap found.

## Go-live checklist (application-level, not infra)

Separate from all of the above — see `scripts/go-live.js`, which handles the one
application-level "must happen before real strangers can post here" step: retiring
the `trollerskates` chaos-bot account (per `bots/PROTOCOL.md`'s "Going live" section).
Infrastructure hardening and this application step are independent; do both.
