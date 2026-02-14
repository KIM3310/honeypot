.SHELLFLAGS := -eu -o pipefail -c
PYTHON ?= python3

.PHONY: backend-install backend-run frontend-install frontend-dev frontend-build ci

backend-install:
	$(PYTHON) -m pip install -r requirements.txt

backend-run:
	# Backend loads env from `proto.env` (see `proto.env.example`)
	$(PYTHON) -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

frontend-install:
	cd frontend && npm ci

frontend-dev:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build

ci: backend-install
	$(PYTHON) -m compileall app
	$(PYTHON) -m unittest discover -s tests -p 'test_*.py'
