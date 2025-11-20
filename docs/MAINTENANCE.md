# 🔧 Maintenance Guide

This guide helps maintainers keep the Smart Translator codebase healthy, updated, and scalable.

---

## **📋 Table of Contents**

- [Regular Maintenance Tasks](#regular-maintenance-tasks)
- [Dependency Management](#dependency-management)
- [Code Quality](#code-quality)
- [Performance Monitoring](#performance-monitoring)
- [Security](#security)
- [Breaking Changes](#breaking-changes)
- [Release Checklist](#release-checklist)

---

## **🔄 Regular Maintenance Tasks**

### **Weekly**

- [ ] Check GitHub Issues for bug reports
- [ ] Review Pull Requests
- [ ] Monitor Chrome Web Store reviews
- [ ] Check API provider status (OpenAI, Claude)

### **Monthly**

- [ ] Update dependencies (`pnpm update`)
- [ ] Review security advisories
- [ ] Check bundle size (`make build`)
- [ ] Analyze cache performance
- [ ] Review telemetry data patterns

### **Quarterly**

- [ ] Major dependency updates
- [ ] Performance audit
- [ ] Security audit
- [ ] Documentation review and updates
- [ ] Code cleanup (remove dead code)

---

## **📦 Dependency Management**

### **Check for Updates**

```bash
# Check outdated packages
pnpm outdated

# Update all dependencies
pnpm update

# Update specific package
pnpm update vite --latest
```

### **Critical Dependencies**

| Package | Current | Purpose | Update Frequency |
|---------|---------|---------|------------------|
| Vite | 5.4.21 | Build tool | Monthly |
| franc-min | Latest | Language detection | Quarterly |

### **Dependency Update Process**

1. **Check compatibility**:
   ```bash
   pnpm outdated
   ```

2. **Update package.json**:
   ```json
   {
     "devDependencies": {
       "vite": "^5.4.21"
     }
   }
   ```

3. **Install and test**:
   ```bash
   pnpm install
   make build
   # Test extension thoroughly
   ```

4. **Commit changes**:
   ```bash
   git commit -m "chore(deps): update vite to 5.4.21"
   ```

---

## **✅ Code Quality**

### **Automated Checks**

```bash
# Run linter (setup ESLint first)
pnpm run lint

# Format code (setup Prettier first)
pnpm run format

# Type checking (if using TypeScript)
pnpm run type-check
```

### **Manual Code Review Checklist**

- [ ] Functions < 50 lines
- [ ] Files < 300 lines
- [ ] No console.log (use logger service)
- [ ] No hardcoded API keys
- [ ] All user input escaped
- [ ] Error handling present
- [ ] JSDoc comments on public functions
- [ ] Consistent naming conventions

### **Remove Dead Code**

```bash
# Find unused exports (manual review)
grep -r "export function" src/ | while read line; do
  func=$(echo $line | sed 's/.*export function \([a-zA-Z_]*\).*/\1/')
  echo "Checking $func..."
  grep -r "$func" src/ --exclude="$(dirname $line)" | wc -l
done

# Remove console.log statements
find src/ -name "*.js" -exec grep -l "console.log" {} \;
```

---

## **⚡ Performance Monitoring**

### **Bundle Size Analysis**

```bash
# Build and check sizes
make build

# Output should be reasonable:
# - background.js: < 100 KB
# - content.js: < 15 KB
# - options/popup: < 10 KB each
```

### **Cache Performance**

Enable Debug Mode and monitor:
```javascript
// Expected metrics:
// - Cache hit: < 10ms
// - Cache miss (API call): 500-5000ms
// - Cache hit ratio: > 70% for regular users
```

### **API Call Optimization**

1. **Monitor timeout errors**:
   - Should be < 1% of total translations
   - If higher, investigate slow endpoints

2. **Check cache effectiveness**:
   ```javascript
   chrome.runtime.sendMessage({ type: 'getCacheStats' }, (stats) => {
     console.log('Cache hit ratio:', stats.hits / stats.total);
   });
   ```

3. **Optimize system prompt**:
   - Current: 75 characters
   - Keep under 100 characters for best performance

---

## **🔒 Security**

### **Regular Security Audit**

```bash
# Check for vulnerabilities
pnpm audit

# Fix automatically if possible
pnpm audit --fix

# Check specific severity
pnpm audit --audit-level=moderate
```

### **Security Checklist**

- [ ] No API keys in code
- [ ] All user input escaped (XSS prevention)
- [ ] Content Security Policy (CSP) in manifest
- [ ] HTTPS-only API endpoints
- [ ] Permissions minimized in manifest
- [ ] No eval() or Function() with user input
- [ ] Sensitive data in chrome.storage.local only

### **Handle Security Vulnerabilities**

1. **Assess impact**:
   - Critical: Immediate patch required
   - High: Patch within 7 days
   - Medium: Patch within 30 days
   - Low: Include in next release

2. **Create patch**:
   ```bash
   git checkout -b security/CVE-XXXX-YYYY
   # Fix vulnerability
   git commit -m "fix(security): patch CVE-XXXX-YYYY"
   ```

3. **Test thoroughly**:
   - Verify fix works
   - Ensure no regression
   - Test on all supported browsers

4. **Release**:
   - Bump patch version
   - Update changelog
   - Publish to Chrome Web Store
   - Notify users if critical

---

## **💥 Breaking Changes**

### **Chrome Manifest Updates**

When Chrome releases new Manifest version:

1. **Review changelog**:
   - Check [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/mv3/)
   - Identify breaking changes

2. **Update manifest.json**:
   ```json
   {
     "manifest_version": 4,  // New version
     // ... update fields as needed
   }
   ```

3. **Refactor code**:
   - Update deprecated APIs
   - Test all features
   - Update documentation

4. **Migration guide**:
   - Document changes in `docs/MIGRATION.md`
   - Provide user notification if needed

### **API Provider Changes**

When OpenAI or Claude changes API:

1. **Monitor announcements**:
   - Subscribe to provider newsletters
   - Check API changelog monthly

2. **Update translator**:
   ```javascript
   // src/background/translator/openAITranslator.js
   // Update endpoint, request format, or response parsing
   ```

3. **Backward compatibility**:
   - Support old and new APIs if possible
   - Provide migration period
   - Update default model selection

4. **Test thoroughly**:
   - Test with old configs
   - Test with new configs
   - Verify error handling

---

## **📦 Release Checklist**

### **Pre-Release**

- [ ] All tests pass
- [ ] No console errors
- [ ] Bundle size acceptable
- [ ] Security audit clean
- [ ] Documentation updated
- [ ] Changelog updated
- [ ] Version bumped in:
  - `package.json`
  - `public/manifest.json`

### **Version Bumping**

Follow [Semantic Versioning](https://semver.org/):

```bash
# Patch (1.0.0 → 1.0.1): Bug fixes
# Minor (1.0.0 → 1.1.0): New features (backward compatible)
# Major (1.0.0 → 2.0.0): Breaking changes

# Update package.json
{
  "version": "1.1.0"
}

# Update manifest.json
{
  "version": "1.1.0"
}

# Commit
git commit -m "chore(release): bump version to 1.1.0"
git tag v1.1.0
```

### **Build & Test**

```bash
# Clean build
make clean
make build

# Create distribution
make zip

# Load in Chrome
# Test ALL features:
# - Text selection → floating icon
# - Translation works (all providers)
# - Cache works
# - Settings save/load
# - Expand mode
# - Copy button
# - Language switching
```

### **Chrome Web Store Submission**

1. **Prepare assets**:
   - Screenshots (1280x800 or 640x400)
   - Promotional images (if applicable)
   - Store description

2. **Upload**:
   - Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   - Upload `smart-translator.zip`
   - Update store listing
   - Submit for review

3. **Post-submission**:
   - Monitor review status
   - Respond to review feedback
   - Notify users of major changes

### **Post-Release**

- [ ] Tag release in GitHub
- [ ] Create GitHub Release with changelog
- [ ] Update README with new version
- [ ] Announce on social media/blog (if applicable)
- [ ] Monitor for bug reports
- [ ] Check crash/error reports

---

## **🐛 Bug Triage**

### **Priority Levels**

| Priority | Description | Response Time | Examples |
|----------|-------------|---------------|----------|
| P0 | Critical - Extension broken | 24 hours | Extension crashes, data loss |
| P1 | High - Major feature broken | 3 days | Translation not working |
| P2 | Medium - Feature degraded | 1 week | Slow performance, UI issues |
| P3 | Low - Minor issue | Next release | Typos, minor UX improvements |

### **Bug Report Template**

```markdown
**Description**
Clear description of the bug

**Steps to Reproduce**
1. Go to '...'
2. Click on '....'
3. See error

**Expected Behavior**
What should happen

**Actual Behavior**
What actually happens

**Environment**
- Chrome Version: 120.0.6099.109
- Extension Version: 1.0.0
- OS: macOS 14.1
- Provider: OpenAI
- Model: gpt-4

**Console Errors**
```
error logs here
```

**Screenshots**
If applicable
```

---

## **📊 Metrics to Track**

### **User Metrics** (if telemetry enabled)
- Total translations
- Cache hit ratio
- Average translation time
- Error rate
- Provider distribution (OpenAI vs Claude)

### **Development Metrics**
- Build time
- Bundle size
- Test coverage (when implemented)
- Time to fix bugs
- Release frequency

### **Quality Metrics**
- Open issues
- Issue resolution time
- User ratings (Chrome Web Store)
- Crash/error rate

---

## **📚 Documentation Maintenance**

### **Keep Updated**

- [ ] `README.md` - Installation, quick start
- [ ] `docs/ARCHITECTURE.md` - System design
- [ ] `docs/CODE_STYLE.md` - Coding standards
- [ ] `docs/API_SPECS.md` - API integration details
- [ ] `docs/AGENTS.md` - AI development guide
- [ ] `CHANGELOG.md` - Version history

### **Documentation Review Checklist**

- [ ] Examples still work
- [ ] Screenshots up to date
- [ ] API endpoints correct
- [ ] Version numbers current
- [ ] Links not broken
- [ ] Code samples formatted

---

## **🚨 Emergency Procedures**

### **Critical Bug in Production**

1. **Assess impact**:
   - How many users affected?
   - Is data at risk?
   - Can users still use basic features?

2. **Hotfix process**:
   ```bash
   git checkout -b hotfix/critical-bug
   # Fix the bug
   # Test thoroughly
   git commit -m "fix(critical): resolve data loss issue"
   
   # Bump patch version
   # Update manifest and package.json
   
   # Build and deploy
   make clean
   make build
   make zip
   
   # Submit to Chrome Web Store as urgent update
   ```

3. **Communication**:
   - Post update on Chrome Web Store
   - Email affected users (if possible)
   - Update GitHub with incident report

4. **Post-mortem**:
   - Document what happened
   - How was it detected?
   - Why did it happen?
   - How to prevent in future?
   - Add tests to prevent regression

---

## **🔄 Deprecation Process**

When removing a feature:

1. **Announce deprecation** (1-2 releases before):
   - Add warning in UI
   - Update documentation
   - Provide migration guide

2. **Mark as deprecated** (1 release before):
   ```javascript
   /**
    * @deprecated Use newFunction() instead. Will be removed in v2.0.0
    */
   function oldFunction() {
     console.warn('oldFunction is deprecated. Use newFunction() instead.');
     // ... implementation
   }
   ```

3. **Remove** (major version bump):
   - Remove code
   - Update tests
   - Update documentation
   - Mention in changelog

---

## **🎯 Long-term Goals**

### **Scalability**
- Support for 100k+ active users
- Sub-100ms cache hits
- < 1% error rate

### **Features**
- Offline translation (local models)
- More language pairs
- Voice translation
- Image text translation

### **Quality**
- 80%+ test coverage
- Automated E2E tests
- Performance benchmarks
- Accessibility (A11y) compliance

---

**Remember**: Maintenance is not just fixing bugs—it's keeping the codebase healthy, secure, and ready for future growth. Document everything, communicate changes clearly, and always prioritize user experience.
