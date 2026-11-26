# Commercial launch checklist

## Must complete before launch

- [ ] Provision and verify the actual host, domain, DNS, HTTPS, firewall and private service networking.
- [ ] Create production-only secrets and pass the production environment validator.
- [ ] Verify migrations, persistent object storage, disk alerts, backup integrity and restore rehearsal.
- [ ] Complete security testing, cross-event authorization regression, dependency review and legal/privacy review.
- [ ] Configure DNS/TLS for both the application domain and signed-upload S3 endpoint; verify origin-restricted CORS.
- [ ] Complete onboarding, administrator, photographer, guest, troubleshooting and incident procedures.
- [ ] Obtain commercial model-weight and training-data legal review.
- [ ] Evaluate on consented, manually labeled event photos with independent event/person splits; meet documented gallery-level false-match criteria.
- [ ] Explicitly approve each event's matching configuration. Keep unapproved public matching disabled.
- [ ] Measure application-level upload, indexing, search, gallery, download and ZIP workloads on target hardware.

## Operating cost categories

Budget for server electricity, internet connectivity, domain renewal, local storage replacement, independent backup storage, and any optional paid services. Estimate monthly electricity as `average measured wall watts × operating hours per day × 30 ÷ 1000 × local tariff per kWh`; divide annual domain renewal by 12 for a monthly equivalent. Add actual ISP, backup-capacity, and replacement costs from provider quotes. Hardware wall draw, local tariff, domain, ISP, and backup destination were not supplied, so no prices are invented. No paid AI or object-storage service is required by the current self-hosted design.

Commercial launch readiness is **blocked** until the items above are evidenced. This checklist is not legal advice.

## Guides and templates prepared

- [Photographer onboarding](PHOTOGRAPHER-ONBOARDING.md)
- [Administrator guide](ADMINISTRATOR-GUIDE.md)
- [Guest usage guide](GUEST-USAGE-GUIDE.md)
- [Troubleshooting and operations](TROUBLESHOOTING-OPERATIONS.md)
- [Operations and maintenance checklist](OPERATIONS-MAINTENANCE.md)
- [Security and privacy checklist](SECURITY-PRIVACY-CHECKLIST.md)
- [Production deployment](PRODUCTION-DEPLOYMENT.md)
- [Backup and recovery](BACKUP-AND-RECOVERY.md)
- [Recognition model decision](RECOGNITION-MODEL-DECISION.md)
- [Representative evaluation workflow](representative-evaluation.md)
- [Privacy and consent draft for counsel](PRIVACY-CONSENT-TEMPLATE.md)
- [Security review](PRODUCTION-SECURITY-REVIEW.md)

The guides are workflow drafts. Before distribution, add product-specific screenshots, the photographer support contact, retention commitments, and named incident/maintenance owners after the production operator is identified.
