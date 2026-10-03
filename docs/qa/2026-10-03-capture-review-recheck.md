# QA report - capture-review (re-check) - 2026-10-03

Scope: re-check of findings #1, #2, #3, #4, #5 and #9 from `docs/qa/2026-10-03-capture-review.md` against the fix commit, then regressions in capture and review: untitled notes with "Add more", type change by voice, leftover reviews, and the still-open findings #6-#8 and #10-#16 |
Builds: web/mobile/backend at commit 9150b92 (QA API rebuilt from this commit) |
Environment: QA API :58600, account feedtest (profile timezone Europe/Moscow), Chrome phone (420) and desktop (1280); emulator no (mobile checked by reading the code) |
AI calls used: 15 of 20

## Re-check of earlier findings

| # | Title (first run) | Verdict | Evidence |
|---|---|---|---|
| 1 | Leaving mid-review drops the review | **Partly fixed** | The banner, Resume and Discard work after the header icon, a row then Back, and a reload. The `beforeunload` prompt fires on reload and doesn't fire without a review (`r1.cjs`). It also works in Hebrew, and on Today (`r1-today.png`, `r2-he-banner.png`). But after a **fresh** capture, leaving and coming back within ~30 s of the page's last capture-list fetch shows **no banner**. It stayed missing for 40 s of polling, until a reload (new finding A3). Edits made before leaving are lost on Resume (A7). |
| 2 | English clarifications in he/ru, repeated question | **Fixed** | Hebrew: "השעה הזו כבר עברה - כדאי לבדוק את התאריך." plus the AI's own "מתי בשבוע הבא הפגישה עם דני?", no English and no second "what time" (`r2-he-capture.json`). Russian: "Это время уже прошло — проверьте дату." plus one AI question. English: one question per item (`r3-ru-RU.json`, `r3-en-US.json`). |
| 3 | Whole-item update skips validation (500, user text in log) | **Fixed** | 5000-char description: 400 "...must be 4000 characters or fewer". 30 reminders: 400 "At most 10 reminders.". End before start, 400-char location and an empty title each return 400. A text-only append over the cap returns 400 "The text would get too long...". The item was unchanged after every one. `api.log` holds none of the test strings and no user words (`r5.cjs` output). |
| 4 | Type change by "Add more" drops the AI title / loses words | **Fixed** | Original case (note "Incomplete fragment" / "Call the pl..." + "Turn this into a task: call the plumber back tomorrow at noon."): the title is kept by default, and "Rename it to “Call plumber back”" is offered unticked. Ticking it saved the task as "Call plumber back". The new words were in the details ("Call the pl...\n\nTurn this into a task: ...") and the due date was tomorrow 12:00 (`r8-*.json`, `r8-review-renamed.png`). In 2 runs where the AI kept the old title, no checkbox appeared (correct) and the words were kept (`r7-lunch`, `r7-plumber`). See A5 for a wording problem. |
| 5 | End before start silently makes an overnight event | **Partly fixed** | "Ends the next day" appears in the review at 12:00 and at 13:00 (= start), not at 13:30. It also appears in the event edit form (`r4.cjs`, `r4b.cjs`). But the Calendar's **new event** form now shows the same hint and then fails with 400 "EndUtc must be after StartUtc." (new finding A4). |
| 9 | Two chips selected in "Save as" | **Fixed** | Whole-item updates show only Task / Event / Note with exactly one selected, in every continue review (`r6`, `r7`, `r8`, `r12`-`r14` output). |

## Summary
Five of the six fixes hold: #2, #3, #4 and #9 fully, and #1 and #5 mostly. The new banner, Resume, Discard, `beforeunload`, translated clarifications and validation all behave correctly in English, Russian and Hebrew at both widths. The worst problems found this time are in "Add more":
(A1) when the user adds something plus an extra request, the AI sometimes proposes a separate item. The server forces that proposal to replace the item: an event became an undated task, and a task lost its due date and details (2 of 3 runs).
(A2) an unsaved "Add more" proposal comes back inside the next "Add more" review of any other item from the same capture, as an update of that item. Save all then fails.
(A3) the new unsaved-review banner doesn't appear if the user leaves right after capturing.
Not covered: the mobile app on a device (code only), voice recordings (no new voice capture this run), Russian UI screenshots.

## Findings
| # | Severity | Area | Title |
|---|---|---|---|
| A1 | Blocker | Add more | An addition with an extra request can replace the whole item: type changes unasked, date/time and details are wiped |
| A2 | Bug | Add more | An unsaved "Add more" proposal comes back in the next "Add more" review of another item from the same capture, as an update of that item; Save all fails |
| A3 | Bug | Review (web) | The "Unsaved review" banner is missing right after a fresh capture (cached capture list, 30 s staleTime) |
| A4 | Bug | Calendar (web) | The new-event form says "Ends the next day", then refuses to save with "EndUtc must be after StartUtc." |
| A5 | UX | Add more | "Its title ... stays" stays on screen after ticking "Rename it to ..."; the tooltip promises a rename option that usually doesn't exist |
| A6 | UX | Review (web) | Unsaved-review banner: "Add more" leftovers show only the capture title; leftovers must be discarded one at a time; older pending ones can be missed |
| A7 | UX | Review | Resume reopens the server's proposals, so edits made before leaving are lost |
| 6 | UX | Add more | Still occurs: a voice addition to a typed-capture item throws the recording away (code unchanged) |
| 7 | UX | Add more | Still occurs: an unrelated "Also call mom tonight" vanished (r12, r14) or was copied verbatim into the details (r13) |
| 8 | UX | Add more | Still occurs: merged details copy instruction words ("make this a task instead: ...", "Turn this into a task: ...") |
| 10 | Polish | Review | Still occurs: "Save 0" button enabled when everything is unticked |
| 11 | Polish | Review | Still occurs: double-clicking Save sends two confirms (200, then 409) |
| 12 | Polish | Add more / type change | Still occurs: 404 console error for the old item after a type change |
| 13 | Polish | Review / Source | Still occurs: emoji icons (🎤, ⌨, ❓) on web and mobile |
| 14 | Polish | Review (continue) | Still occurs: the read-only title looks editable (it now has a tooltip, see A5) |
| 15 | Polish | Item audio | Not re-tested (no voice capture this run; `audioSnippet` was not changed by the fix) |
| 16 | Polish | Review | Still occurs: "The user wants to buy batteries tomorrow..." |

### A1. An addition with an extra request can replace the whole item  (Blocker, confidence: high - 2 of 3 runs)
- Steps: 1. Capture "Buy batteries tomorrow, and dinner with Sara on Friday at 19:00." and Save, which gives the event "Dinner with Sara", Fri 19:00-20:00. 2. Open the event, "Add more - keep talking", type "Ask her about the concert tickets as well. Also call mom tonight.", press Enter. 3. Press Save all.
- Expected: the event stays an event at Fri 19:00 and the new sentence is added to its details. CLAUDE.md: "Add more" updates strictly that item, and the type changes only when the user explicitly asks.
- Actual: the AI proposed a separate item (Task "Ask about tickets", no date). The server turned it into the whole-item update. The review showed "Changes it from Event to Task", empty Date/Time, and Details holding only the new sentence. After Save all, the event is gone. In its place is a task "Dinner with Sara" with **no date** and details "Ask her about the concert tickets as well." (`r14-before.json` / `r14-after.json`: start 2026-10-09T16:00Z before, nothing after.) Same pattern on the task "Call plumber back" (due tomorrow 12:00, two paragraphs of details). After "Ask him about the kitchen tap as well. Also call mom tonight." the task had **no due date** and only the new sentence as details (`r12-before.json`, `r12-after.json`, `r12-review-full.png`). A third run ("Buy batteries") merged correctly (`r13`), so it depends on what the AI returns. The review does show the change, but the default action (Save all) destroys data, and nothing like "the date will be removed" is said.
- Evidence: `tools/qa/out/r14-*.json`, `r14-review.png`, `r12-*.json`, `r12-review-full.png`.
- Where: `backend/src/AiPlanner.Application/Captures/Services/CaptureService.cs:519-521`. `OrderByDescending(i => i.AddsToCurrent).Take(1).Select(i => i with { AddsToCurrent = true })` promotes a proposal the AI meant as a *new* item to the item's replacement. `ApplyToItemAsync` (~:775) then writes its null due date / Task intent. Affects mobile too (server + `shared/captureDraft.ts`).
- Suggestion: when the AI didn't mark a proposal `addsToCurrent`, keep the item's own type, dates and details and only append the words.

### A2. An unsaved "Add more" proposal leaks into the next "Add more" review of a sibling item  (Bug, confidence: high)
- Steps: 1. A capture produced several items (here "Call plumber" event, "Lunch with Dana" event and a note). 2. "Add more" on "Call plumber", get the review, and leave without Save/Cancel, so the proposal stays pending. 3. Later, "Add more" on the **note** from the same capture.
- Expected: the review shows only the note's addition.
- Actual: the review shows two items. The first is the plumber proposal, presented as an update **of the note**: "Changes it from Note to Event", "Rename it to “Call plumber”", details about the spare key. The second is the note's own update. Save all returns 400 "The note to add to was not found." (the first item converts the note, the second can't find it; the transaction rolls back). Unticking the stray item saves fine and rejects it. If the leftover came first and the user's own item was unticked, the note would have been turned into the plumber event.
- Evidence: `tools/qa/out/r6b-review-two-proposals.png`, `r6b.cjs` output (confirm request + 400), `r6-continue.json`. I made the leftover through the API (`r5.cjs`, a continue with every confirm refused). The same happens in the UI when a user leaves an "Add more" review, which the #1 fix now explicitly keeps.
- Where: `web/src/components/CaptureReview.tsx:33` and `mobile/src/components/CaptureReview.tsx:44` take *every* `PendingReview` item of the capture and apply `appendTarget` to all of them.
- Suggestion: in continue mode, review only the proposals returned by that continue call (or reject older pending `addsToCurrent` items when a new continue starts).

### A3. The unsaved-review banner is missing right after a fresh capture  (Bug, confidence: high)
- Steps: 1. Open the feed (web, 420 or 1280). 2. Within ~30 s type a capture and press Enter; the review opens. 3. Tap a feed row, then Back (or use a header icon and come back).
- Expected: "Unsaved review: ... Resume / Discard" above the capture box (the #1 fix).
- Actual: no banner and no review. I polled for 40 s after Back and it never appeared; only a reload brought it. When the feed had been open for 35 s before capturing, it did appear (`r11.cjs`: "banner after Back (list cache was stale): 1"). Reproduced at 1280 (`r9.cjs` timed out waiting for it) and at 420 (`r10.cjs`: `0000...0`, `r10-after-back.png`).
- Where: `web/src/lib/usePendingReview.ts` (query `['captures','pending']`); `web/src/main.tsx:12` `staleTime: 30_000`. `capturesApi.text/voice` in `CaptureBar.run` is not a `useAction`, so the list isn't invalidated when a capture is created. Mobile has the same hook and staleTime, but there the review survives navigation (CaptureDock), so it only matters there after the app is closed (a cold start fetches fresh).
- Suggestion: invalidate `['captures','pending']` after a capture is created (or set `staleTime: 0` for that query).

### A4. New event (Calendar): "Ends the next day" shown, then the save fails  (Bug, confidence: high)
- Steps: Calendar, click a day header, title "QA overnight event", Start 22:00, End 01:00, Save.
- Expected: an event that ends at 01:00 the next day, as the hint says. The review and the edit form both add a day.
- Actual: the hint "Ends the next day" shows, but the request sends end < start, and the form shows the server's developer message **"EndUtc must be after StartUtc."** (English, field names) (`r4b.cjs` output: request start 19:00Z, end 22:00Z the previous day).
- Evidence: `tools/qa/out/r4-newform-endsnextday.png`, `r4-newform-after.png`.
- Where: `web/src/components/AppointmentForm.tsx:30` (`endUtc: zonedToUtc(date, end, ...)` with no next-day step, unlike `AppointmentDetailPage.tsx:150` and `captureDraft.ts:142`). Mobile has no create form.

### A5. Rename wording contradicts itself  (UX, opinion, confidence: high)
- After ticking "Rename it to “Call plumber back”", the line above still says "Updates “Incomplete fragment” - its title and created date stay." (`r8-review-renamed.png`).
- The read-only title's tooltip "The title stays - rename it below if you like" appears on every whole-item update. In most of them (same type, or the AI kept the title) there is nothing below to rename with (`r6`, `r7`, `r12`-`r14`).
- Where: `web/src/components/CaptureReview.tsx` (`review.updatesItem`, `review.titleKept`); mobile shows the same `updatesItem` line.

### A6. Banner details  (UX, opinion, confidence: high)
- An "Add more" leftover shows as "Unsaved review: “Pick up package” · Discard": the capture's title, no Resume, and no hint that it was an addition to an item (`r1-420-banner.png`).
- Leftovers queue up: discarding one immediately shows the next. This account had 12 from the first run and needed 12 Discards (I cleared them through the API).
- `usePendingReview` looks only at the newest 10 captures (`capturesApi.list(10)`). A pending capture within the 7-day window but older than the last 10 captures is never offered.
- At 1280, coming Back restores the scroll position, so the banner at the top can be off-screen (`r11-banner.png`).

### A7. Resume loses edits made before leaving  (UX, opinion, confidence: high)
- Typed "MY EDIT before leaving" into Details, went to Calendar and back, pressed Resume: Details showed the AI's original text again (`r1.cjs`: "after resume, first textarea: \"Call the bank this morning at 7.\""). The `beforeunload` prompt protects reloads, but in-app navigation drops the edits without a warning.

### Still-open findings from the first run (confirmed, not re-investigated)
- #6: `CaptureService.cs:494` still deletes the audio of an addition to a typed capture.
- #7: "Also call mom tonight" vanished in r12/r14 and was copied as text into the details in r13. Never a separate item or a hint.
- #8: details such as "Lunch with Dana on Tuesday from 13:00 to 14:00. make this a task instead: buy a new faucet washer before the weekend." (`r7-lunch-after.json`) and "Turn this into a task: ..." (`r8-after.json`). The fallback join now uses a paragraph break, which helps.
- #10: "Save 0", enabled (`r11-save0.png`).
- #11: confirms 200 then 409 "This item was modified by another device." on double-click (`r11.cjs`). "Saved 2 items." is still shown and there are no duplicates.
- #12: a 404 console error after each type change (r7, r8, r14).
- #13: `web/src/components/CaptureReview.tsx:76,259`, `web/src/components/SourceCapture.tsx:36`, `mobile/src/components/CaptureReview.tsx:265`, `mobile/src/components/SourceCapture.tsx:41`.
- #14: same input styling plus a tooltip (A5).
- #16: summary "The user wants to buy batteries tomorrow and has dinner with Sara on Friday at 19:00." (`r9-capture.json`).

## What works well
- Banner: shows on Feed and Today. Resume reopens the same capture (same items). Discard rejects every pending item (`Rejected, Rejected`). An "Add more" leftover offers only Discard, and discarding it rejects only the pending proposal. The banner doesn't flash for a capture just saved (polled every 250 ms for 3 s). Correct in Hebrew RTL ("בדיקה שלא נשמרה: ״...״ המשך · מחיקה").
- `beforeunload`: prompts on reload mid-review (dismiss keeps the review open; accept reloads, and the banner then offers it back). No prompt without an open review.
- Server clarifications in he/ru/en: translated, with no duplicate when-questions.
- Validation of whole-item updates and text-only appends: all 400, item untouched, nothing logged.
- **Untitled notes stay untitled after "Add more"**: a note with `title: null` received an addition, was saved, and is still `title: null` with the merged content (`r6check.cjs`). The review and the "Updates ..." line use its first words.
- Type change keeps the created date (`created` identical before and after in r7, r8, r14) and navigates to the new id.
- "Ends the next day" appears in the review (end earlier than or equal to start) and in the event edit form. Saving 13:00-12:00 stores Wed 12:00 as before.
- No page errors at either width, apart from the 404/409/400 noted above.

## Not covered / follow-ups
- Mobile app not run. By code, it shares the banner hook, `endsNextDay`, the Rename checkbox and `CaptureReview`'s pending-item filter, so A1, A2, A5 and #10, #13 and #14 apply there too. A3 mostly doesn't (the review survives navigation). A4 doesn't (no create form).
- No new voice capture or voice addition (#6 and #15 checked by code only).
- One AI-quality observation, not filed: "Remind me about vitamins" (no time) came back as a Note with no reminder and no question in both ru and en (`r3-*.json`). The user is not asked when to be reminded.
- AI calls: 15 of 20 used.
