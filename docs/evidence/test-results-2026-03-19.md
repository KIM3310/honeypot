# honeypot — Test Results

> Generated: 2026-03-19 | Runner: pytest 8.3.5 | Python 3.11.15

## Test Suite Summary

| Metric | Value |
|--------|-------|
| Total tests collected | 33 |
| Passed | **33** |
| Failed | 0 |
| Execution time | **1.90s** |
| Pass rate | 100% |

## Test Breakdown by Module

| Test File | Tests | Coverage Area |
|-----------|-------|---------------|
| test_csrf_rotation.py | 1 | CSRF token rotation |
| test_frontend_handover_contract.py | 2 | Frontend handover contract |
| test_input_validation.py | 2 | Input validation |
| test_llm_override.py | 4 | LLM override controls |
| test_metrics_limits.py | 1 | Metrics rate limiting |
| test_ops_metrics.py | 1 | Operations metrics |
| test_security_headers.py | 3 | Security header enforcement |
| test_security_runtime.py | 5 | Runtime security controls |
| test_service_meta.py | 6 | Service metadata contract |
| test_smoke.py | 4 | Smoke tests (health, endpoints) |
| test_task_manager.py | 2 | Task manager operations |
| test_upload_authz.py | 2 | Upload authorization |

## Security Coverage

The test suite validates a comprehensive security posture:
- CSRF rotation, security headers, runtime security (9 tests)
- Input validation and upload authorization (4 tests)
- LLM override controls preventing prompt injection (4 tests)
- Metrics rate limiting to prevent abuse (1 test)

## Performance

All 33 tests complete in under 2 seconds, indicating fast endpoint response times and efficient test isolation.
