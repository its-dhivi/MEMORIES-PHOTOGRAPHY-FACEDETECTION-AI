# Administrator guide

Use a named administrator account with a unique password and the least access needed. Keep administrative diagnostics private. Never paste credentials, access tokens, guest selfies, face embeddings, signed object URLs, or private evaluation labels into tickets or logs.

## Service operations

For deployment and configuration, follow [Production deployment](PRODUCTION-DEPLOYMENT.md). Use read-only health checks first:

```sh
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml ps
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml logs --tail 100 api face-ai
```

Keep PostgreSQL, Redis, RustFS administration, API, web, and face-AI on the private Compose network. Confirm only approved reverse-proxy endpoints are externally reachable. Do not run `down -v`, prune volumes, or point a restore at production during routine troubleshooting.

## Events and matching

- Create events under the correct studio/tenant, set access PIN and download settings, and review the public slug before issuing a QR code.
- Confirm detector and recognition model readiness and version compatibility before indexing. Reindexing should use a reviewed, resumable migration plan with a backup and rollback path.
- Review photo diagnostics only for events you are authorized to operate. Labels used in evaluation must be manually assigned from consented evidence; predictions are never ground truth.
- Production event approval requires a trusted signed gallery evaluation artifact. Do not construct metrics manually or share the signing secret with browsers, photographers, or ordinary API clients.
- Keep approval disabled for unvalidated events. Candidate model embeddings must remain version-isolated and must not appear in guest results.

## Privacy requests and incidents

Follow the approved retention and deletion policy for selfie sessions, embeddings, event photos, and evaluation data. Record who handled a request and what data was deleted without copying biometric contents into the audit trail. For suspected exposure, restrict access, preserve non-sensitive audit evidence, rotate affected credentials, and follow the studio's incident plan and counsel's instructions.

Before production, fill in the responsible administrator, escalation contact, retention owner, backup RPO/RTO, and the local legal/privacy review outcomes. See [Security review](PRODUCTION-SECURITY-REVIEW.md), [Privacy notice draft](PRIVACY-CONSENT-TEMPLATE.md), and [Backup and recovery](BACKUP-AND-RECOVERY.md).
