# Risk Register

## Current Risk Classification

- Tier: low selected risk tier, with automation-specific controls recommended
- Owner: Adam Goodwin
- Last reviewed: 2026-06-30T10:32:05-06:00

## Key Risks

| ID | Risk | Likelihood | Impact | Controls | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- |
| R-001 | False chunk-boundary detection sends `/compact` too early | Medium | High | Require boundary signal plus idle/input-ready signal; dry-run first; log detector decision | Adam | Open |
| R-002 | Tool sends commands into the wrong VS Code terminal | Low | High | Use managed session ids, observability levels, and explicit operator arming | Adam | Open |
| R-003 | Automation loops after task completion | Medium | Medium | Add complete/blocked/needs-human terminal states and stop on uncertainty | Adam | Open |
| R-004 | Existing arbitrary terminal cannot be read reliably | High | Medium | Show as candidate/unsupported; offer managed relaunch; no unattended automation | Adam | Open |
| R-005 | Cross-platform terminal behavior differs between Windows and Linux | Medium | Medium | Validate terminal I/O path on both platforms in Chunk One and packaging smoke tests | Adam | Open |
| R-006 | Public release overclaims reliability | Medium | Medium | Document limitations, observability levels, and supported session types before release | Adam | Open |
| R-007 | Command injection or unsafe resume text is sent to a managed session | Low | High | Keep compact/resume text profile-controlled, require operator arming, dry-run first, and pause/stop on uncertain output | Adam | Open |

## 2026-06-30 Review Notes

- Public README now states current limitations and does not claim release-ready
  packaging.
- Candidate and unsupported sessions remain non-armable.
- Next live testing should remain disposable and Adam-observed before any
  broader packaging or release claims.
