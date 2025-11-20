.PHONY: dev build zip clean install watch-content format lint check pre-commit

install:
	pnpm install

dev:
	@echo "Building for development..."
	@make build
	@echo "\nDevelopment build complete! Load 'dist' folder in Chrome."
	@echo "Run 'make watch' in another terminal to auto-rebuild on changes."

watch:
	@echo "Watching for changes..."
	@(trap 'kill 0' SIGINT; \
		BUILD_TARGET=content pnpm run dev & \
		pnpm run dev & \
		wait)

format:
	@echo "Formatting code with Prettier..."
	pnpm run format

format-check:
	@echo "Checking code formatting..."
	pnpm run format:check

lint:
	@echo "Linting code with ESLint..."
	pnpm run lint

lint-fix:
	@echo "Fixing linting issues..."
	pnpm run lint:fix

check:
	@echo "Running format and lint checks..."
	pnpm run check

pre-commit:
	@echo "Running pre-commit checks (same as git commit)..."
	pnpm exec lint-staged

build:
	@echo "Building main bundle..."
	pnpm run build
	@echo "Building content script..."
	BUILD_TARGET=content pnpm run build

zip:
	cd dist && zip -r ../smart-translator.zip .

clean:
	rm -rf dist node_modules smart-translator.zip

help:
	@echo "Available commands:"
	@echo "  make install      - Install dependencies"
	@echo "  make dev          - Build once for development"
	@echo "  make watch        - Build and watch for changes (auto-rebuild)"
	@echo "  make build        - Build production version (main + content script)"
	@echo "  make format       - Format code with Prettier"
	@echo "  make format-check - Check code formatting"
	@echo "  make lint         - Lint code with ESLint"
	@echo "  make lint-fix     - Fix linting issues automatically"
	@echo "  make check        - Run format and lint checks"
	@echo "  make zip          - Create distributable ZIP file"
	@echo "  make clean        - Remove dist, node_modules, and zip file"
