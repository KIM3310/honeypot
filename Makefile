.SHELLFLAGS := -eu -o pipefail -c
PYTHON ?= python3
VENV ?= .venv
VENV_PYTHON := $(VENV)/bin/python
BACKEND_STAMP := $(VENV)/.backend-installed

.PHONY: backend-install backend-run frontend-install frontend-dev frontend-build frontend-test verify ci

$(VENV_PYTHON):
	$(PYTHON) -m venv $(VENV)

$(BACKEND_STAMP): pyproject.toml requirements.txt
	@if [ ! -x "$(VENV_PYTHON)" ] || ! $(VENV_PYTHON) -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 11) else 1)" >/dev/null 2>&1; then \
		rm -rf $(VENV); \
		$(PYTHON) -m venv $(VENV); \
	fi
	@if ! $(VENV_PYTHON) -m pip --version >/dev/null 2>&1; then \
		$(VENV_PYTHON) -m ensurepip --upgrade; \
	fi
	$(VENV_PYTHON) -m pip install -U pip
	$(VENV_PYTHON) -m pip install -e ".[dev]"
	touch $(BACKEND_STAMP)

backend-install: $(BACKEND_STAMP)

backend-run: backend-install
	# Backend loads env from `proto.env` (see `proto.env.example`)
	$(VENV_PYTHON) -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

frontend-install:
	cd frontend && npm ci

frontend-dev:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build

frontend-test:
	cd frontend && npm run verify

verify: backend-install frontend-install
	$(VENV_PYTHON) -m compileall app
	$(VENV_PYTHON) -m pytest -q
	$(MAKE) frontend-test

ci: verify
