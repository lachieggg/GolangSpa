DB_PATH := sqlite://app.db
MIGRATE := $(shell go env GOPATH)/bin/migrate
MIGRATIONS := $(shell pwd)/backend/migrations
PORT ?= 8080

# OpenAPI
OPENAPI_SPEC := openapi.yaml
GO_MODELS_DIR := backend/
OPENAPI_GENERATOR := openapi-generator-cli
GO_MODELS_FILE := backend/models.gen.go
GO_BIN := $(shell go env GOPATH)/bin

.PHONY: clean run setup buildgo buildreact gen-go-models apigen deps migrate-install migrate-up migrate-down npm-install check help

# ---------- System checks ----------
check:
	@command -v go >/dev/null 2>&1 || { echo "❌ Go is not installed. Please install Go."; exit 1; }
	@command -v npm >/dev/null 2>&1 || { echo "❌ npm is not installed. Please install Node.js and npm."; exit 1; }
	@echo "✅ Required tools found."

# ---------- Full setup ----------
setup: check deps apigen migrate-install buildgo buildreact migrate-up
	@echo "✅ Setup complete."

# ---------- Go backend ----------
buildgo:
	go mod tidy
	go build -o app ./backend
	@echo "✅ Go backend built."

# ---------- Frontend ----------
npm-install:
	cd frontend && npm install

buildreact: npm-install
	cd frontend && npm run build
	@echo "✅ React frontend built."

# ---------- Run ----------
run:
	./app -port $(PORT)

# ---------- Clean ----------
clean:
	rm -f app app.db
	@echo "🧹 Cleaned build artifacts and database."

# ---------- Go module dependencies ----------
deps:
	go mod tidy
	@echo "✅ Dependencies tidied."

# ---------- Generate OpenAPI models ----------
apigen: npm-install install-oapi
	cd frontend && npm run generate:types && cd ..
	@echo "Generating Go models..."
	@mkdir -p $(dir $(GO_MODELS_FILE))
	@PATH=$(GO_BIN):$$PATH oapi-codegen -generate types -o $(GO_MODELS_FILE) -package main $(OPENAPI_SPEC)
	@echo "✅ Go models generated in $(GO_MODELS_FILE)"

install-oapi:
	@echo "Installing oapi-codegen CLI (v2)…"
	go install github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@latest
	@echo "✅ oapi-codegen installed"

# ---------- Migrations ----------
migrate-install:
	@echo "Installing migrate CLI (sqlite enabled)…"
	go install -tags 'sqlite' github.com/golang-migrate/migrate/v4/cmd/migrate@v4.17.0
	@echo "✅ migrate CLI installed."

migrate-up:
	$(MIGRATE) -path $(MIGRATIONS) -database $(DB_PATH) up

migrate-down:
	$(MIGRATE) -path $(MIGRATIONS) -database $(DB_PATH) down

# ---------- Testing ----------
test:
	go test -v ./backend/...

# ---------- Help ----------
help:
	@echo "Available Makefile targets:"
	@echo "  check           - Verify required tools are installed (Go, npm)"
	@echo "  setup           - Install deps, build CLI, build backend/frontend, apply migrations"
	@echo "  buildgo         - Build Go backend"
	@echo "  buildreact      - Build React frontend"
	@echo "  run             - Run the app"
	@echo "  clean           - Remove build artifacts and database"
	@echo "  deps            - Tidy Go module dependencies"
	@echo "  apigen          - Generate Go and frontend models from OpenAPI spec"
	@echo "  migrate-install - Install migrate CLI (sqlite enabled)"
	@echo "  migrate-up      - Apply migrations"
	@echo "  migrate-down    - Rollback migrations"
	@echo "  test            - Run Go unit tests"
	@echo "  help            - Show this help message"