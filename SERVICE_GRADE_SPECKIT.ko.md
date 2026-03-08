# honeypot Service-Grade SPECKIT

Last updated: 2026-03-08

## S - Scope
- 대상: Azure 기반 handover document generator prototype
- baseline 목표: secure architecture, retrieval flow, enterprise adoption evidence를 서비스 수준으로 정리

## P - Product Thesis
- honeypot은 prototype이더라도 `Azure-native enterprise document workflow`라는 메시지가 분명해야 한다.
- 리뷰어는 architecture credibility와 governance posture를 먼저 읽어야 한다.

## E - Execution
- Azure reference architecture와 retrieval/eval evidence를 핵심 표면에 유지
- sample handover flow와 generated artifact를 재현 가능하게 유지
- CI와 docs를 buyer/operator 관점으로 계속 정리

## C - Criteria
- build/test green
- README 첫 부분에서 Azure 문맥과 보안 경계가 설명됨
- generated handover artifact와 evidence path가 명확함

## K - Keep
- enterprise architecture 중심 접근
- honest prototype framing

## I - Improve
- retrieval quality dashboard 추가
- architecture screenshot / runbook pack 강화

## T - Trace
- `README.md`
- `app/`
- `docs/`
- `.github/workflows/`

