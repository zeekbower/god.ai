#!/usr/bin/env bash
# AWS-tailored install: runs the normal scripts/setup.sh for the core dependency/
# service install, then layers on the instance-level hardening from AWS-HARDENING.md
# that's actually applicable from inside a running instance. The infrastructure half
# of that document (VPC, ALB, WAF, IAM roles, Secrets Manager) has to be provisioned
# separately by whoever holds the AWS account — this script can't create AWS
# resources, it only hardens the instance it's running on and prepares the app to use
# AWS services if they're available.
#
# Usage: ./scripts/setup-aws.sh
# Safe to re-run, same as setup.sh.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

log()  { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
warn() { printf '\033[1;33m!! %s\033[0m\n' "$1"; }
err()  { printf '\033[1;31mERROR: %s\033[0m\n' "$1" >&2; }

# ---------------------------------------------------------------------------
log "Running the base install (scripts/setup.sh)"
# ---------------------------------------------------------------------------
./scripts/setup.sh

# ---------------------------------------------------------------------------
log "Checking whether this is actually an EC2 instance"
# ---------------------------------------------------------------------------
IS_EC2=0
if TOKEN=$(curl -sf -m 2 -X PUT "http://169.254.169.254/latest/api/token" \
    -H "X-aws-ec2-metadata-token-ttl-seconds: 60" 2>/dev/null); then
  IS_EC2=1
  echo "Running on EC2 with IMDSv2 available."
elif curl -sf -m 2 "http://169.254.169.254/latest/meta-data/" >/dev/null 2>&1; then
  IS_EC2=1
  warn "Running on EC2, but IMDSv2 (token-required) is NOT enforced on this instance."
  warn "This matters specifically because of the axios SSRF findings in SECURITY.md's"
  warn "Wiki.js audit — with IMDSv1 allowed, an app-layer SSRF can steal this"
  warn "instance's IAM credentials directly from the metadata service with zero auth."
  warn "Fix from an AWS-CLI-configured machine (not from inside this instance):"
  warn "  aws ec2 modify-instance-metadata-options --instance-id <id> \\"
  warn "    --http-tokens required --http-endpoint enabled"
else
  echo "Not running on EC2 (metadata service unreachable) — skipping AWS-specific checks."
fi

# ---------------------------------------------------------------------------
log "Confirming services bind to localhost only (exposure should happen via an ALB)"
# ---------------------------------------------------------------------------
NODEBB_URL="$(node -e "console.log(JSON.parse(require('fs').readFileSync('forum/config.json')).url)" 2>/dev/null || echo "")"
if [[ "$NODEBB_URL" == *"0.0.0.0"* ]]; then
  warn "forum/config.json's \"url\" contains 0.0.0.0 — on AWS this should be the ALB's"
  warn "domain (https://...), with NodeBB itself only reachable from the ALB via the"
  warn "app-tier security group, not directly from the internet."
fi
if grep -q "^bindIP: 0.0.0.0" wiki/config.yml 2>/dev/null; then
  echo "Wiki.js bindIP is 0.0.0.0 (binds all interfaces) — fine as long as the app-tier"
  echo "security group only allows inbound from the ALB's security group, per"
  echo "AWS-HARDENING.md's network architecture section. This script can't verify your"
  echo "actual security group rules — check those in the AWS console/CLI."
fi

# ---------------------------------------------------------------------------
log "Secrets: checking for AWS Secrets Manager availability"
# ---------------------------------------------------------------------------
if [ "$IS_EC2" = "1" ] && command -v aws >/dev/null; then
  echo "AWS CLI found. If you've stored NodeBB's session secret, Wiki.js's API key, or"
  echo "bot passwords in Secrets Manager (see AWS-HARDENING.md), pull them into this"
  echo "environment before starting services, e.g.:"
  echo '  export WIKIJS_API_KEY=$(aws secretsmanager get-secret-value --secret-id <name> --query SecretString --output text)'
  echo "This script does not do that pull automatically — which secrets exist and what"
  echo "they're named is specific to your account, not something to guess at here."
else
  echo "Not on EC2 or AWS CLI not installed — secrets stay in .env.local / bots/*.env"
  echo "as in local dev. Fine for now; see AWS-HARDENING.md before a real launch."
fi

# ---------------------------------------------------------------------------
log "Reminder: this script does not provision AWS infrastructure"
# ---------------------------------------------------------------------------
echo "VPC, subnets, security groups, ALB, ACM certificate, WAF, IAM roles, GuardDuty,"
echo "Config/Security Hub, EBS encryption, and backup schedules all need to be set up"
echo "through the AWS console, CLI, or IaC (Terraform/CloudFormation) separately —"
echo "see AWS-HARDENING.md for the full list and why each one matters for this"
echo "specific app (the IMDSv2 section especially — it directly addresses a real"
echo "finding from SECURITY.md's dependency audit, not a generic best practice)."
echo ""
echo "Once real infrastructure exists: run ./scripts/go-live.js before letting real"
echo "strangers reach this deployment — it retires the trollerskates chaos-bot account,"
echo "the one application-level step that has to happen before launch."
