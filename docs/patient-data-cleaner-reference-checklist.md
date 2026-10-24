# Patient Data Cleaner PDF Reference-to-Implementation Checklist

Source: `Patient_Data_Cleaner_Design.pdf` (5 pages). All content below is transcribed or summarized from the rendered reference and its selectable text. The PDF's example rows and counts are illustrative synthetic data.

## Shared visual and interaction rules

- [ ] Use the reference's pale gray page, white surfaces, dark navy text, teal-green primary accent, and restrained green/amber/red statuses.
- [ ] Match the compact header, centered content width, compact type hierarchy, border/radius treatment, and card proportions.
- [ ] Keep the `Check → Fix → Export` stepper visible on pages 2, 3, and 5; page 4 is a focused review screen with a back action and progress bar.
- [ ] Use only the synthetic PDF fixture in the reference state. Never present reference counts or sample values as results for a user upload.
- [ ] Keep uploaded-file results data-derived and use the existing local parser, profile, mapping, validation, filter, and export logic.
- [ ] Existing runtime schema and validation rules remain authoritative for real uploads; patient-specific policy must not be inferred from illustrative screens.

## Page 1 — Concept / flow overview

- [ ] Title: “Patient Data Cleaner — Redesign”.
- [ ] Flow line: “Check → Fix → Export: spell-check for patient data”.
- [ ] Four numbered statements: Check health summary; Fix issue cards with before/after previews; Review one by one values the system won't guess; Export clean file, follow-up list, change log.
- [ ] Footer identifies sample rows from `patient_data_100.xlsx` as synthetic and issue counts as illustrative.
- [ ] Treat this page as explanatory reference, not an additional in-app route unless needed by the current navigation.

## Page 2 — Check

- [ ] Header: Patient Data Cleaner brand; Check/Fix/Export progress; “Synthetic data only · stays in your browser”.
- [ ] Compact file strip: `patient_data_100.xlsx`, Patients sheet, 134 records, 32 columns, Change file.
- [ ] Summary heading: “We checked 134 patient records”; subtitle: “Most of your file is usable. 7 issues need a decision before you export.”; segmented status bar.
- [ ] Four horizontal summary values: Ready 58; We can fix 49; Needs your eye 23; Can't fix here 4, each with its PDF explanation.
- [ ] Two-column body: left “What we found” list sorted by affected records; right compact “How we read your columns” mappings and minor-missingness summary.
- [ ] Issue order and reference labels/counts: DOB formats (41), gender inconsistency (38), patient-ID formats (19), age/DOB mismatch (2), missing MRN (1), then “+ 2 more issues (name typos, marital status shorthand)”.
- [ ] Preserve example values and wording only in the separate synthetic reference state.
- [ ] Bottom actions: “Start fixing” and “Export as-is”.
- [ ] Mapping panel shows Record ID → Patient ID; MRN → MRN; Full name → Patient Name; Date of birth → Date of Birth; Gender → Gender. Each has Change.
- [ ] Compact note: 27 other columns retained; minor optional blanks; “See column details and profile downloads”. Do not expose the full profile table by default.
- [ ] Change opens an edit control for one mapping; default panel remains a compact summary.

## Page 3 — Fix

- [ ] Heading “Fix 7 issues”; subtitle: “Every change shows a before and after. Nothing changes in your file until you approve it.”
- [ ] Stacked issue cards in PDF order; completed Gender card has result summary and Undo.
- [ ] Expanded DOB issue card is Issue 2 of 7, includes status, YYYY-MM-DD explanation, 5-row before/after table, dotted-date question and the two interpretation choices.
- [ ] Actions: “Fix 40 dates”, “Review one by one”, “Skip”, “See all 41”.
- [ ] Remaining cards: patient-ID formats, age/DOB mismatch, names that may be misspelled, marital-status shorthand, missing MRN; retain their different review/blocked semantics.
- [ ] Right sidebar: progress (1 of 7, 14%), values changed (37), waiting for review (1), follow-up list (0), Continue to export, and “What the colors mean”.
- [ ] Only explicitly approved safe transformations may alter outputs; ambiguous dates, IDs, ages, names, and missing MRN are never silently guessed.

## Page 4 — Individual review

- [ ] Focused screen with Back to all issues, “Reviewing: values we won't guess”, and item count 1 of 4.
- [ ] Main card: “What gender is Sarah Kim?”; explanation of ambiguous value `2`; choices Female, Male, Other / unknown, Leave as “2”.
- [ ] Actions: “I don't know: add to follow-up list”; “Use this answer for every ‘2’ in Gender”.
- [ ] Right sidebar “The full record” with listed fields; “Show all 32 fields”; “Up next” with three review prompts.
- [ ] Human choices affect only the current synthetic record/rule scope explicitly selected; no inferred global policy.

## Page 5 — Export

- [ ] Heading “Your clean file is ready”; reference totals 130 ready, 4 follow-up, 118 values changed, explicitly labeled synthetic.
- [ ] Three export cards: MAIN FILE Clean patient file (.xlsx/.csv); FOLLOW-UP Records to chase (.csv); AUDIT Change log (.csv).
- [ ] Recent changes table columns Patient, Field, Before, After, How; show four reference examples only in the synthetic fixture.
- [ ] Lower two-column layout: “Need only some patients?” with City, Newark, Baltimore, Add, matching count and download; “For data teams” profile, quality, mapping/fix rules.
- [ ] Real-file export counts and filter matches derive from the current uploaded file and applied approvals.

## Implementation checkpoints

- [x] Build a distinct synthetic reference state from the PDF examples; label it clearly and keep it separate from uploaded-file state.
- [x] Keep the current processing engine for real files; no reference fixture enters real-upload processing or exports.
- [x] Give preview-only actions an explanatory state; keep real upload, processing, and data-derived exports in the existing workflow.
- [x] Capture and inspect local Check, Fix, Review, and Export screenshots against the five-page PDF. The concept cover remains documentation only; it is not an extra in-app route.
- [x] Run syntax checks, the full test suite, build, and browser checks.

## Verification notes

- Browser preview URL: `http://127.0.0.1:8001/demo.html`.
- The browser displayed all four implemented reference views and the approved Q&A recommendations. A known recommendation returned its approved answer.
- The “Use my file” action switched to the existing real-file workflow. The automated app test uploaded a synthetic CSV and confirmed the upload state stayed separate from the reference state.
- No live customer or patient file was uploaded. Browser console error/warning inspection returned no messages for the tested page.
- The screenshot review found the expected desktop card hierarchy and narrow viewport stacking. Ask DataCare is opened from the reference banner so its floating launcher does not cover the PDF-style mapping area; the usual launcher remains in real-file mode.
- The PDF supplies only five example DOB values and selected recent-change examples. “See all 41” therefore explains the limitation instead of inventing rows. Reference download buttons do not create files.
- Patient-specific sample mappings and review choices remain illustrative. The real-file engine remains governed by the repository’s customer-data contract and does not infer patient-specific rules.
