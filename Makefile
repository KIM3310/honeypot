.SHELLFLAGS := -eu -o pipefail -c
PYTHON ?= python3
VENV ?= .venv
VENV_PYTHON := $(VENV)/bin/python
BACKEND_STAMP := $(VENV)/.backend-installed

.PHONY: backend-install backend-run frontend-install frontend-dev frontend-build ci

$(VENV_PYTHON):
	$(PYTHON) -m venv $(VENV)

$(BACKEND_STAMP): pyproject.toml requirements.txt | $(VENV_PYTHON)
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

ci: backend-install frontend-install
	$(VENV_PYTHON) -m compileall app
	$(VENV_PYTHON) -m unittest discover -s tests -p 'test_*.py'
	cd frontend && npm run build
