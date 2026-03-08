# honeypot Service-Grade SPECKIT

Last updated: 2026-03-08

## S - Scope
- 대상: Azure 기반 handover document generator prototype
- 이번 iteration 목표:
  - Azure trust boundary와 runtime posture를 reviewer-friendly contract로 노출
  - handover draft 구조를 schema endpoint로 명시
  - 로그인 화면과 메인 workspace에서 즉시 읽히는 readiness board 추가

## P - Product Thesis
- honeypot은 prototype이더라도 `Azure-native enterprise handover workflow`라는 메시지가 분명해야 한다.
- 중요한 것은 기능 수가 아니라 `upload -> extract -> retrieve -> draft -> operator review` 흐름이 서비스처럼 읽히는가이다.
- 리뷰어는 아래를 바로 이해해야 한다:
  - 이 시스템이 어떤 클라우드 경계 안에서 동작하는가
  - 어떤 운영/보안 제어가 이미 구현되었는가
  - handover draft가 어떤 구조를 갖는가
  - 지금 데모 모드인지, 실제 Azure 경로가 활성화됐는지

## E - Execution
- 백엔드
  - `app/service_meta.py` 추가
  - `GET /api/meta`
  - `GET /api/runtime-brief`
  - `GET /api/schema/handover`
  - `/api/health` capabilities/links 확장
- 프론트엔드
  - `ServiceReadinessBoard` 컴포넌트 추가
  - runtime brief를 login/workspace에 함께 노출
  - 로그인 화면에 compact readiness board 삽입
  - 메인 workspace 우측 상단에 compact readiness board 삽입
  - 백엔드 미연결 시 static fallback meta/schema 사용
- 테스트
  - `tests/test_service_meta.py`
  - `tests/test_smoke.py` 확장

## C - Criteria
- `python -m unittest discover -s tests -p 'test_*.py'` green
- `cd frontend && npm run build` green
- README에 새 service-grade surface가 설명된다
- 로그인 전에도 서비스 문맥, runtime contract, review pack이 UI에서 읽힌다

## K - Keep
- enterprise architecture 중심 접근
- honest prototype framing
- human review required 원칙 유지

## I - Improve
- retrieval quality dashboard 추가
- architecture screenshot / runbook pack 강화
- role-based document visibility와 persistent security store로 확장

## T - Trace
- `README.md`
- `SERVICE_GRADE_SPECKIT.ko.md`
- `app/main.py`
- `app/service_meta.py`
- `frontend/App.tsx`
- `frontend/components/LoginScreen.tsx`
- `frontend/components/ServiceReadinessBoard.tsx`
- `tests/test_service_meta.py`
