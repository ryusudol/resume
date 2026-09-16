TECTONIC ?= tectonic
RESUME_DIR := resumes

TEX := $(wildcard $(RESUME_DIR)/*.tex)
PDFS := $(TEX:.tex=.pdf)

.PHONY: build swe frontend clean FORCE

build: $(PDFS)
swe: $(RESUME_DIR)/Suhyeon_Yu_SWE_Resume.pdf
frontend: $(RESUME_DIR)/Suhyeon_Yu_Frontend_Resume.pdf

# Always compile so edits under content/ are picked up.
# -Z search-path=. resolves resumestyle.sty and content/ from the repo root.
$(PDFS): %.pdf: %.tex FORCE
	@mkdir -p .build
	@out=".build/$(notdir $*).out"; \
	if ! "$(TECTONIC)" --keep-logs --outdir .build -Z search-path=. "$<" > "$$out" 2>&1; then \
		cat "$$out" >&2; \
		exit 1; \
	fi
	@cp ".build/$(notdir $@)" "$@"

FORCE:

clean:
	rm -rf .build
