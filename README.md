# Suhyeon Yu SWE resume

`Suhyeon_Yu_SWE_Resume.tex` builds `Suhyeon_Yu_SWE_Resume.pdf` using Calibri Regular
body text with Bold headings and emphasis. The other font previews have been removed.

LaTeX is the source of truth. Edit the files under `content/` directly. The
original `swe_resume.docx` is retained only as an optional reference; it is not
used by the build. All its visible text was verified against the PDF before
removing the import and comparison scripts. There is no page limit for the draft.

## Build and edit

Tectonic is required. Run from the repository root:

```sh
make          # compile the resume
make clean    # remove build intermediates; keep the final PDF
```

The `scripts/` directory and Python build dependency have been removed. The build
checks compilation success; inspect the PDF after content or layout changes.
Poppler remains available for optional inspection with `pdfinfo`, `pdftotext`,
and `pdftoppm`. Override the compiler path with the Make variable `TECTONIC`.

## Typography and shared content

The resume uses 10 pt body text with 12 pt baseline spacing, 11 pt entry/project
titles, 12 pt section headings, and a 24 pt name. US Letter pages have 0.5-inch
margins. Layout settings are centralized in `resumestyle.sty`.

Calibri loads from the system when available, otherwise from Microsoft Word's
local font directory. Font files are not copied into the repository. On another
computer, install Calibri or set `\resumeCalibriPath` to its font directory.
The PDF embeds the font subsets needed for viewing.

`Suhyeon_Yu_SWE_Resume.tex` selects modules from `content/shared/`, `content/experience/`,
`content/projects/`, and `content/skills/`. The future MLE version can share the
style and common facts while selecting its own content.

For Overleaf, use XeLaTeX with `Suhyeon_Yu_SWE_Resume.tex` as the main file, and
provide the shared style, content directory, and appropriately licensed Calibri
fonts. pdfLaTeX is unsupported.

## Reference

The modular organization was informed by
[yarikama/resume_latex](https://github.com/yarikama/resume_latex), reviewed at commit
`50b67e4b7fed745468b4f6f766cb535a0cf71394`. Its license notice is preserved below for the reference material, not as a license for personal resume content.

Henry's Makefile uses `latexmk -xelatex`, Poppler's `pdfinfo`, and a one-page check.
This project uses Tectonic and allows multiple pages. Keep
`XeTeXgenerateactualtext` disabled: it corrupted extracted text with Tectonic
0.17.0 during the font comparison.



&nbsp;