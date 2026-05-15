# Security Policy

## Vulnerability Management

### Current Status

**Vulnerabilities Fixed:** 12 → 7 (58% reduction)

| Severity | Count | Type | Impact |
|----------|-------|------|--------|
| Moderate | 7 | Dev-only (vite/esbuild) | Low (dev-time only) |
| High | 0 | — | — |

### Remaining Vulnerabilities

All 7 remaining vulnerabilities are in **dev-only dependencies** and do not affect the compiled CLI or runtime security:

1. **esbuild <=0.24.2** (GHSA-67mh-4wv8-2f99)
   - **Issue:** Dev server can receive arbitrary requests
   - **Impact:** Only affects running `npm run dev` (development only)
   - **Not affected:** Production CLI, published npm package, Docker image
   - **Awaiting:** Upstream fix in vite ecosystem

2. **vite <=6.4.1**
   - Depends on vulnerable esbuild
   - Used only for `vitest` testing framework
   - Not included in production distribution

3. **vitest <=2.2.0-beta.2**
   - Testing framework (dev-only)
   - Used for `npm test`
   - Not in production bundle

### Production Security

The **compiled and published slak CLI is secure**:

- ✅ No production vulnerabilities
- ✅ No runtime dependencies with known issues
- ✅ Type-safe (TypeScript strict mode)
- ✅ Dependency audit passes for production code
- ✅ OAuth tokens never logged or leaked

### Development Recommendations

**Safe to use for development:**
```bash
npm install      # Safe
npm run dev      # Dev server only
npm test         # Safe
npm run build    # Safe (no dev server)
```

**If you need zero dev vulnerabilities:**
```bash
# Force downgrade to older vitest (may have breaking changes)
npm audit fix --force
# Or: npm install vitest@4.1.6
```

### Mitigations

1. **Dev-only scope:** Vulnerabilities are isolated to development workflow
2. **No bundling:** Dev dependencies are not included in distributed package
3. **Type safety:** Strict TypeScript prevents many common security issues
4. **CI/CD gates:** Type-check and tests must pass before release
5. **Token handling:** Uses keytar (OS keychain) for secure storage

### Reporting Security Issues

If you find a security issue in slak:

1. **Do NOT open a public issue**
2. Email security details to: [maintainer email]
3. Include steps to reproduce
4. Allow time for patch development before disclosure

## Dependency Audit

Last updated: 2026-05-15

### Production Dependencies (27)
- @oclif/core@^4.1.26
- @slack/web-api@^7.16.0
- @slack/oauth@^3.0.5
- @slack/socket-mode@^2.0.7
- conf@^13.0.1
- keytar@^7.9.0
- open@^9.0.0
- chalk@^5.3.0
- ora@^8.1.0
- inquirer@^12.1.0
- fastest-levenshtein@^1.0.16
- cli-table3@^0.6.4
- mime-types@^2.1.35
- *and others*

**Status:** ✅ Zero known vulnerabilities

### Dev Dependencies (15)
- @oclif/test@^3.0.0
- @typescript-eslint/*@^8.0.0
- vitest@^2.0.0
- @vitest/coverage-v8@^2.0.0
- @vitest/ui@^2.0.0
- eslint@^9.0.0
- nock@^14.0.0
- typescript@^5.2.0
- prettier@^3.0.0
- *and others*

**Status:** ⚠️ 7 moderate (dev-only, vite ecosystem)

## Version Policy

slak follows semantic versioning: `MAJOR.MINOR.PATCH`

### Security Patches

- Released immediately when production vulnerabilities are discovered
- Published as `PATCH` version bump
- Announced in GitHub Security Advisories

## Future Improvements

- [ ] Monitor vite/esbuild for esbuild >=0.25 release
- [ ] Upgrade to vite v7 when available (may resolve all remaining vulns)
- [ ] Consider switching to alternative test frameworks (if vitest remains vulnerable)
- [ ] Annual dependency audit and update cycle

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [npm audit documentation](https://docs.npmjs.com/cli/v8/commands/npm-audit)
- [Slack API Security](https://api.slack.com/authentication/best-practices)
