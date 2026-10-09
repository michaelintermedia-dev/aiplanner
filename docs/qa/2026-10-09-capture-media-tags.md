# QA run 2026-10-09 - captures with photos, tags, find, search

Scope: everything added on 2026-10-08/09 - tags on every item, the capture
bar's media drawer, the AI reading photos/documents (consent, photo-only
captures, language rule, auto tags), attachment descriptions, "find ..." by
voice or text, search across every text, type changes, the phone dock.

Setup: QA API copy on :58600, QA account reset + seeded (`seed.cjs`), real
OpenAI, fake voice from `say.ps1`. Scripts: `tools/qa/out/scenarios.cjs`
(API, 35 checks) and `tools/qa/out/ui-scenarios.cjs` (web at phone width,
10 checks). Also: 180 backend unit tests, web + mobile typecheck.

## Result

API 35/35 and UI 10/10 after two fixes. Unit tests 180/180.

## Found and fixed in this run

1. **A tag the user already has could come back in another case** - "tag it
   family" proposed "family" while the user has "Family". Saving still used
   the existing tag (names are case-insensitive), but the review showed the
   other spelling. Fix: proposals are mapped to the user's own spelling
   (`CaptureService.ProposeAsync`).
2. **A photo's description didn't always carry the words people search
   with** - the router label was described as "Wireless Password", so "wifi
   password" found nothing. Fix: every description now ends with a
   "Keywords:" line of everyday search words and synonyms
   (`OpenAiMediaDescriptionService`).

## Not bugs

- The smart Save once sent "Pay the electricity bill on Friday" to the review
  instead of saving it: the AI asked a question that time, and anything
  unclear goes to the review by design. A rerun saved at once.
- Consent can't be put back to "not asked" (a PUT with null keeps the value) -
  intended; the test now turns it off instead.

## Checked and working

Consent off -> photo-only refused and files not read; smart Save; 2-4 auto
tags (specific + broad); one entry per message; "tag it ..." by text and
voice; find by text and by voice (search, no items, right kind/words);
photo-only flyer -> event with date/time/place, "Photo:" title; plain photo in
a Russian app -> Russian title and description; English PDF -> English
description; voice + photo -> event, no "Photo:" label; attachment described
~2 s after upload; search by a photo's description, an event's people, the
captured words; tag filter on events; type change keeps tags and photos;
delete + undo keeps tags; adding "tag it urgent" in the Edit page keeps the
other tags; tag list ordered by use. UI: review tag chips preselected and
editable; Edit page comma-separated new tags; photo capture saved at once with
the photo attached and described; picture viewer caption; feed tag filter
with counts; Settings switch.

Not covered here (needs a phone): the Samsung camera, the phone dock's
drag/swipe on device, the Quick recording long-press on device.
