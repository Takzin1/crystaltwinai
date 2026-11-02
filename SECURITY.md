# Security Policy / セキュリティポリシー

## Supported code

This project is research-oriented and currently has **no formally supported stable release series**. Security fixes are considered for the latest `main` branch on a best-effort basis. No production safety or service availability guarantee is made.

## Privately reporting vulnerabilities

Please use GitHub's **Report a vulnerability** / private vulnerability reporting feature on the repository's Security tab **if it is enabled**. If the feature is unavailable, open a GitHub Issue requesting a private disclosure channel **without posting exploit details, secrets, or sensitive files**. Do not publish vulnerable code paths or real credentials while arranging private contact.

We cannot commit to a fixed response time. Maintainers will evaluate reports and coordinate fixes and public advisories where practical.

## Sensitive environments

- Never use CrystalTwinAI for real equipment control, medical or operational safety decisions.
- Never submit confidential experiment datasets, personal information, API keys or passwords in issues or PRs.
- Never enable unreviewed remote data import or execution. Local input size, checksums, units, and source-provenance boundaries exist for safety.
- Report unexpected data exfiltration, stored secrets, supply-chain issues, or unsafe execution instructions privately.

機密データや脆弱性の詳細を公開Issueに書き込まないでください。実設備制御には利用できません。
