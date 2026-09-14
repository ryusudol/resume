# Override these executable paths when they are not on PATH.
TECTONIC ?= tectonic
RESUME_DIR := resumes
TEX_SOURCES := $(wildcard $(RESUME_DIR)/*.tex)
PDFS := $(TEX_SOURCES:.tex=.pdf)

.PHONY: build swe clean FORCE
build: $(PDFS)
swe: $(RESUME_DIR)/Suhyeon_Yu_SWE_Resume.pdf

# Always invoke the compiler: edits to any shared module must be picked up.
# Copy the PDF only after compilation succeeds.
# search-path=. keeps \usepackage{resumestyle} and \input{content/...} resolving
# from the repository root when the driver lives under resumes/.
# Tectonic's Calibri-from-Word warnings are expected; keep them off the
# successful build, and print the captured log only if compilation fails.
$(PDFS): %.pdf: %.tex FORCE
	@mkdir -p .build
	@out=".build/$(notdir $*).out"; \
	if ! "$(TECTONIC)" --keep-logs --outdir .build -Z search-path=. "$<" > "$$out" 2>&1; then \
	  cat "$$out" >&2; \
	  exit 1; \
	fi
	@cp ".build/$(notdir $@)" "$@"

FORCE:

# Generated build files and QA previews only; keep source and deliverable PDFs.
clean:
	rm -rf .build
