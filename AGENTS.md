# Repository Guidelines

## Project Structure & Module Organization

`Suhyeon_Yu_SWE_Resume.tex` directly selects and orders the SWE sections. `resumestyle.sty` owns typography, margins, spacing, and reusable LaTeX commands. Content lives in `content/shared/`, `content/experience/`, `content/projects/`, and `content/skills/`. LaTeX content is the source of truth; `swe_resume.docx` is an optional original reference and is not a build dependency. The import and validation scripts have been removed; `README.md` preserves the reference license notice. Builds use `.build/` before copying compiled PDFs to the repository root.

## Build, Test, and Development Commands

Run commands from the repository root with Tectonic available:

- `brew install tectonic poppler`: install the compiler and PDF inspection tools on macOS.
- `make` or `make check`: compile every resume listed in `RESUMES` in the Makefile.
- `make swe`: compile the SWE resume.

Override the compiler path through the `TECTONIC` Make variable. Poppler tools remain available for manual PDF inspection. Use Tectonic or XeLaTeX; pdfLaTeX is unsupported.

## Coding Style & Naming Conventions

Match existing formatting: two-space indentation for nested LaTeX content, and tabs for Make recipes. Use lowercase, hyphenated content filenames, such as `abc-fitness-swe.tex`; resume drivers use names such as `Suhyeon_Yu_SWE_Resume.tex`. Keep layout controls in `resumestyle.sty`, avoiding manual spacing in content modules. Confirm commands used by content are defined in the style package. No formatter or linter is configured.

## Testing Guidelines

There is no dedicated unit-test framework or coverage threshold. After content or layout changes, run `make check` and visually inspect the PDF for overlap, wrapping, and readability. The current draft allows multiple pages. The build checks compilation success. Use Poppler to inspect extracted text when font or encoding settings change. Use Calibri Regular body text with Bold emphasis; keep `XeTeXgenerateactualtext` disabled to avoid documented extraction defects.

## Commit & Pull Request Guidelines

The repository has no commits yet. Use concise, imperative commit subjects, for example `Refine SWE project bullets`. PRs should explain the change, identify affected sections, and report validation results. Include a PDF preview for layout changes and link an issue when applicable.

## Content Integrity

Edit LaTeX content modules directly and keep shared dates, metrics, and claims consistent across role variants. Do not invent accomplishments. Create explicitly named variants for role-specific wording.
