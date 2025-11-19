.PHONY: dev build zip clean install

install:
	pnpm install

dev:
	pnpm run dev

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
	@echo "  make install  - Install dependencies"
	@echo "  make dev      - Start development server with watch mode"
	@echo "  make build    - Build production version (main + content script)"
	@echo "  make zip      - Create distributable ZIP file"
	@echo "  make clean    - Remove dist, node_modules, and zip file"
