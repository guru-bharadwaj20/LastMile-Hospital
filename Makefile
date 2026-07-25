# LastMile — common tasks.
#
#   make help        list targets
#   make check       everything CI runs, locally
#   make up          full stack in Docker
.DEFAULT_GOAL := help

DASHBOARD := lastmile
SDN       := SDN_files
COMPOSE   := docker compose

.PHONY: help
help: ## Show this help
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
	  | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

# ── Dashboard ───────────────────────────────────────────────────

.PHONY: install
install: ## Install dashboard dependencies
	cd $(DASHBOARD) && npm ci

.PHONY: dev
dev: ## Run the dashboard dev server
	cd $(DASHBOARD) && npm run dev

.PHONY: build
build: ## Production build of the dashboard
	cd $(DASHBOARD) && npm run build

.PHONY: lint
lint: ## ESLint
	cd $(DASHBOARD) && npm run lint

.PHONY: typecheck
typecheck: ## tsc --noEmit
	cd $(DASHBOARD) && npm run typecheck

.PHONY: test-js
test-js: ## Dashboard tests
	cd $(DASHBOARD) && npm run test

# ── SDN layer ───────────────────────────────────────────────────

.PHONY: install-py
install-py: ## Install Python dev dependencies
	pip install -r $(SDN)/requirements-dev.txt

.PHONY: lint-py
lint-py: ## ruff
	cd $(SDN) && ruff check .

.PHONY: test-py
test-py: ## Flow table, QoS policy and API payload tests
	cd $(SDN) && pytest

.PHONY: policy
policy: ## Print the QoS policy table
	cd $(SDN) && python3 qos.py

.PHONY: flows
flows: ## Print the derived forwarding table
	cd $(SDN) && python3 flow_table.py

# ── Everything ──────────────────────────────────────────────────

.PHONY: check
check: lint typecheck test-js lint-py test-py ## Run every check CI runs
	@echo "All checks passed."

# ── Docker ──────────────────────────────────────────────────────

.PHONY: up
up: ## Dashboard only, on http://localhost:8081
	$(COMPOSE) up --build dashboard

.PHONY: up-sdn
up-sdn: ## Controller + Mininet + dashboard (needs privileged Docker)
	$(COMPOSE) --profile sdn up --build

.PHONY: bench
bench: ## Run the benchmark in Docker, writing results/qos_benchmark.csv
	$(COMPOSE) --profile bench run --rm benchmark

.PHONY: report
report: ## Fold benchmark results into the README
	python3 $(SDN)/report_results.py results/qos_benchmark.csv --update-readme

.PHONY: down
down: ## Stop everything and remove volumes
	$(COMPOSE) --profile sdn --profile bench down -v

.PHONY: clean
clean: ## Remove build output and caches
	rm -rf $(DASHBOARD)/dist $(DASHBOARD)/coverage
	find . -type d -name __pycache__ -prune -exec rm -rf {} +
	find . -type d -name .pytest_cache -prune -exec rm -rf {} +
