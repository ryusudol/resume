# Override these executable paths when they are not on PATH.
TECTONIC ?= tectonic
RESUMES := Suhyeon_Yu_SWE_Resume
PDFS := $(addsuffix .pdf,$(RESUMES))

.PHONY: all swe check clean FORCE
all: check
swe: Suhyeon_Yu_SWE_Resume.pdf
check: $(PDFS)

# Always invoke the compiler: edits to any shared module must be picked up.
# Copy the PDF only after compilation succeeds.
$(PDFS): %.pdf: %.tex FORCE
	mkdir -p .build
	"$(TECTONIC)" --keep-logs --outdir .build "$<"
	cp ".build/$@" "$@"

FORCE:

# Generated build files and QA previews only; keep source and deliverable PDFs.
clean:
	rm -rf .build
