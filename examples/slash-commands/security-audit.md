---
name: security-audit
description: Perform security-focused code review
parameters: [{"name": "severity", "description": "Minimum severity level to report", "required": false, "type": "string", "default": "medium"}]
examples: ["/security-audit", "/security-audit severity=high"]
---

When this command is used, conduct a comprehensive security audit of the code changes:

## Security Checklist

1. **Input Validation**
   - Check for proper sanitization of user inputs
   - Verify parameter validation and bounds checking
   - Look for potential injection vulnerabilities (SQL, XSS, Command Injection)

2. **Authentication & Authorization**
   - Review authentication logic for weaknesses
   - Verify authorization checks are in place
   - Check for privilege escalation risks

3. **Data Protection**
   - Identify sensitive data handling
   - Verify encryption for sensitive data at rest and in transit
   - Check for hardcoded credentials or secrets

4. **Error Handling**
   - Ensure errors don't leak sensitive information
   - Verify proper exception handling
   - Check for information disclosure vulnerabilities

5. **Dependencies**
   - Review new dependencies for known vulnerabilities
   - Check for outdated packages with security issues

## Output Format

Present findings in a security report format:
- **CRITICAL**: Immediate security risks that must be fixed
- **HIGH**: Serious vulnerabilities that should be addressed soon
- **MEDIUM**: Potential security concerns that need review
- **LOW**: Minor issues or best practice recommendations

Provide specific code references and remediation guidance for each finding.
