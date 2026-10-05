# QA report - item Edit page (re-check) - 2026-10-05

Scope: a re-check of [2026-10-05-item-edit.md](2026-10-05-item-edit.md) findings #1-#16 after the fixes in d9ba70d, plus regressions near them (feed capture review, a real pending-review banner, Discard all, a non-form "Add more" review resumed from the banner, the follow-up review, the draft notice, Hebrew) |
Builds: web/mobile/backend at commit d9ba70d |
Environment: QA API :58600, account feedtest (profile TZ Europe/Moscow, Chrome TZ America/New_York), Chrome 420 + 1280, emulator no (mobile checked by reading `mobile/src/components/ItemEditor.tsx`, `ItemEditMode.tsx`, the item screens and `lib/reviewDrafts.ts`) |
AI calls used: 23 of 25

## Re-check of earlier findings

| # | Earlier finding | Verdict | Evidence |
|---|---|---|---|
| 1 | Event → note/task loses location and people | **Fixed** | Event → Note: form and saved note `"Agenda here\n\nLocation: Room 42\nWith: Anna, Boris"`. Event → Task with location/people edited in the form first ("Cafe Roma", "Anna, Boris, Clara"): saved task description has both. (Small leftover: switching back to Event doesn't put them back in their fields, see new #5.) `rc1.cjs` |
| 2 | Save fails after the type change → stranded on a deleted item | **Fixed** (Cancel at that point isn't, see new #1) | The `PUT /appointments/{new}` after the convert was made to fail once with Playwright `page.route` (500). The form stayed open with "Simulated failure", the Event chip still on and "Changes it from Task to Event" shown. A second Save went straight to the PUT (no second convert), succeeded and opened `/appointments/{new}`: location "Room 7", description "Edited in form", start, the "15 min before" reminder and the original created date all kept. Only one feed row, no draft left in localStorage. Screenshot `rc1-partial-fail.png` |
| 3 | The form's addition shows in the feed banner; discarding it there breaks Save | **Fixed** | With a held addition stored as a draft: no banner on the feed, `GET /captures?pendingDays=7` is empty for it. With two real pending captures as well, the banner said "Unsaved review: “Birthday playlist” · Resume · Discard · Discard all 2" (count excludes the held one). Discard all left the held proposal `PendingReview, heldByEditForm: true`, and Save from the restored draft then worked (priority High saved, no error). `rc4.cjs`, `rc5.cjs`, `rc4-banner.png` |
| 4 | The follow-up review captures twice | **Fixed** | "…Also call mom tonight." → offer shown → Save → review "Call mom" → Save all: `POST /captures/text` called exactly once (0 → 1), the review closed, nothing pending. `rc4.cjs`, `rc4-followup.png` |
| 5 | An addition brings back a hand-removed reminder, Reminder marked | **Fixed** (incl. Daily/Weekly) | Task with "1 hour before" + "Every day at 8:00" + "Mon, Wed at 9:00". "1 hour before" removed by hand, then "The door code is 1234.": reminders stayed Daily + Weekly, the only mark was Description. On an event with a Daily reminder (the "31 February" case) Reminder wasn't marked either. `rc2.cjs`, `rc2-a-info.png` |
| 6 | A second addition can't correct the first | **Fixed** (3 of 3 corrections) | "Remind me 30 minutes before" → "Actually make it 1 hour before instead of 30 minutes" → only "1 hour before". "Change the daily reminder to 7:30 instead of 8" → Daily 7:30 replaced 8:00 (Weekly kept). "Make it high priority" → "Actually no, low priority is enough" → Low. Saved: `Daily 07:30, Weekly 09:00 Mon/Wed, Before 60`, priority Low. `rc2-corrections.png` |
| 7 | An unusable date moves the event to today | **Fixed** (the words now land in the description instead, see new #3) | "Move it to the 31st of February.": date 2026-10-08 10:00 kept and not marked, clarification "February 31 doesn't exist — which date did you mean?" shown. `rc2-clar.png` |
| 8 | Cancel keeps the cancelled words and audio | **Fixed** for Cancel (not when the draft is lost, see new #4) | Typed-capture item: "Move it to Monday." was in the transcript before Cancel and gone after it; the source card doesn't show it. Voice item: 1 part → two voice additions → 3 parts (durations 2650/4680/4020) → Cancel → 1 part `[2650]`, transcript back to the original sentence, "Play this part" still works. Hand-made item: after Cancel the capture is empty, there's no source card. `rc2.cjs`, `rc3.cjs` |
| 9 | Added details start with a stray ". " | **Fixed** | "Leak under the sink\n\nThe door code is 1234.", and later reworded by the AI to "Leak under the sink. The door code is 1234." Same for "Bring the blue toolbox." No leading punctuation in any run. |
| 10 | Saving over a newer change made elsewhere | **Fixed** (the "Discard my changes" path has a problem, see new #2) | Rename + priority change via the API while the form was open → Save shows "This item was changed somewhere else after you opened it." with "Save mine anyway" / "Discard my changes". Save mine anyway: the form's version saved (expected). Discard my changes: the server keeps the other change and the form closes. Item deleted elsewhere: "Task not found." Hebrew text is translated and fits at 420 (`rc5-he-conflict.png`). `rc1-conflict.png` |
| 11 | "Also buy milk on the way home" went into the details | **Fixed in this run** (AI-dependent, 1 of 1) | It was offered as "Also capture “Also buy milk on the way home.” as a new entry"; details "Bring the blue toolbox." |
| 12 | Ongoing + "before" reminder: "Add a time…" | **Fixed** | "An ongoing task has no time, so a “before” reminder can’t work - pick a different reminder." Save is disabled. |
| 13 | Back gives no prompt; no sign of a draft on the view | **Fixed** (by the notice; Back still leaves silently, as designed) | After Back, the view shows "You have unsaved changes to this item. · Continue editing", which restores the draft. No notice before any edit, after Save, after Cancel, after an edit typed and then reverted, or after "Discard my changes". `rc1-draft-notice.png` |
| 14 | 404s for the deleted recording after Save | **Fixed** | Save with "Delete recording": no 404, no console errors. The card says "The recording was deleted; the transcription is kept." `rc3-after-delete.png` |
| 15 | Title > 300 chars not caught by the form | **Fixed** | 301 chars: "The title is too long (at most 300 characters)." and Save is disabled. 300 chars, or 299 with spaces around them: allowed. |
| 16 | "With (comma-separated)" wraps at desktop | **Fixed** | At 1280 the "With" label is one line (height 18.5 px, same as "Location"). `rc1-labels-1280.png` |

## Summary
All 16 earlier findings are fixed on web, and the mobile code has the same changes (it shares `shared/itemForm.ts` and mirrors `ItemEditor`/`ItemEditMode`). The happy paths around them still work: feed capture and Save all, a real pending review with Resume / Discard / Discard all, a non-form "Add more" review resumed from the banner, and the follow-up review. The new problems are in edge paths of the fixes. **Cancel after a half-done type change** leaves the user on the deleted old item, even though the type change was kept. **"Discard my changes"** leaves a stale view, so editing again runs straight into the same conflict. **A date the AI asks about** now keeps the date, but the user's instruction is pasted into the description. **An Edit-form addition whose draft is lost** (another browser or device, cleared storage, or the item changed elsewhere) stays held forever, and its words show as the item's source. No regressions in the flows listed above. The emulator wasn't used.

## Findings
| # | Severity | Area | Title |
|---|---|---|---|
| 1 | Bug | Save / Cancel | Cancel after a half-done type change shows the deleted old item; the type change is kept anyway |
| 2 | Bug | Conflict | "Discard my changes" leaves the stale version on screen; Edit again → the same conflict |
| 3 | Bug | Voice/text merge | A date the AI asks about: the instruction ("Move it to the 31st of February.") is put into the description |
| 4 | Bug | Drafts | An Edit-form addition whose draft is lost stays held forever; its words show as the item's source |
| 5 | Polish | Type chips | Event → Task → Event: place and people stay in the text, and the Location/With fields are empty |

### 1. Cancel after a half-done type change shows the deleted old item; the type change is kept anyway  (Bug, confidence: high, 3 of 3)
- Steps: 1. Task "RC half cancel" with a date and time → Edit → Type chip Event. 2. Save while the `PUT /appointments/{new}` fails (forced once with Playwright `page.route`, 500) → "Simulated failure". 3. Press Cancel.
- Expected: "Cancel drops it all" (the Edit page's promise). Either the type change is undone, or, since it can't be, the user lands on the new event.
- Actual: the view of the **old task** comes back at the old URL ("TASK · RC half cancel · Planned · Complete / Cancel task / Edit"), but `GET /tasks/{old}` is 404 and the feed has only an **Event** with that title (converted, without the form's other edits). Pressing Complete shows "Task not found."; a reload shows "Task not found. Back to tasks".
- Evidence: `rc1b.cjs` output, `tools/qa/out/rc1b-half-cancel.png`, `rc1-partial-cancel.png`.
- Where: `web/src/components/ItemEditor.tsx` `cancel()` calls `onDone(null)` even when `current.id !== item.id`, and doesn't invalidate the old item's query unless there were proposals. Same code in `mobile/src/components/ItemEditor.tsx`.
- Suggestion: when `current` differs from `item`, Cancel should call `onDone({ moved: current })` (and drop the stale query), or say the type change was already saved.

### 2. "Discard my changes" leaves the stale version on screen; Edit again → the same conflict  (Bug, confidence: high, 2 of 2)
- Steps: 1. Task → Edit → change Notes. 2. Elsewhere (API = another device) rename it and set priority High. 3. Save → conflict → "Discard my changes".
- Expected: the view shows the newer version (that's what the user chose to keep).
- Actual: the view still shows the old title "RC conflict B" and "Medium priority"; the server has "Renamed B" / High. Edit opens the form with the stale values, and any Save hits the conflict again ("conflict 1, editor 1"). Only a reload or a refetch gets out of it.
- Evidence: `rc1b.cjs` output, `tools/qa/out/rc1b-discard-view.png`.
- Where: `ItemEditor.tsx` `cancel()` only invalidates queries `if (proposals.length)`; the conflict's Discard button reuses `cancel`. Same on mobile.
- Suggestion: invalidate the item's query after "Discard my changes" (or always on Cancel).

### 3. A date the AI asks about: the instruction is put into the description  (Bug, confidence: high, 1 run + code)
- Steps: event (Oct 8, 10:00) → Edit → "Move it to the 31st of February."
- Expected: the clarification, the date kept, and nothing else changed.
- Actual: the date is kept and the question is shown, but Description becomes "Move it to the 31st of February." and is marked as changed by the AI. Save would store the instruction as the event's description.
- Evidence: `rc2.cjs` output (`#7 … "marks":["Description"], "desc":"Move it to the 31st of February."`), `tools/qa/out/rc2-clar.png`.
- Where: `ContinuedItem.Keep`: the new clarification rule puts the date back, so `ChangesFields` is false and the "nothing else changed, the words were information" branch appends the words to the details (ContinuedItem.cs, around lines 101-131).
- Suggestion: when a proposal carries a clarification, don't treat the words as information (leave the details alone).

### 4. An Edit-form addition whose draft is lost stays held forever; its words show as the item's source  (Bug, confidence: high, 1 run + code)
- Steps: 1. Hand-made task "RC held" → Edit → "Make it high priority." 2. Leave the page (the draft is kept on this device only). 3. Open the task in another browser or device, or after clearing site data, or after the item changed elsewhere (`loadDraft` then drops the draft).
- Expected: the addition is either offered somewhere or dropped, so it doesn't stick to the item (Cancel now takes words back out, #8).
- Actual: the task is priority None with no draft notice, but its source card says "From a typed capture · What you typed: Make it high priority." The proposal stays `PendingReview, heldByEditForm: true` forever: not in the banner, not touched by Discard all, and nothing can ever decide it, so its words and audio parts stay in the capture.
- Evidence: `rc6.cjs` output (`"input":"Make it high priority.","items":[["PendingReview",true]]`, the source card text).
- Where: `HeldByEditForm` proposals are only ever resolved by the form's Save/Cancel (`CaptureService`); the draft lives in localStorage / `editDrafts` per device. The same applies on mobile.
- Suggestion: when Edit opens without a usable draft, take back (reject + take back) the item's held proposals; or expire them after a while.

### 5. Event → Task → Event: place and people stay in the text, and the fields are empty  (Polish, opinion)
- Steps: event with Location "Cafe Roma", With "Anna, Boris, Clara" → Edit → Task chip → Event chip.
- Actual: Location and With are empty; the description has "Location: Cafe Roma\nWith: Anna, Boris, Clara". Saving as an event keeps them in the text, not in the fields. Switching to Task again doesn't duplicate the lines, which is good.
- Suggestion: keep the original location/people in the form state until Save and only fold them into the text for a non-event Save.

## What works well
- Type change: event → note/task folds place and people into the text (localised labels). A half-failed Save carries on with the new item on retry (one convert only, created date and reminders kept).
- Conflict check: rename/priority elsewhere → clear message, both buttons work, Hebrew translated and no overflow. A deleted-elsewhere item gives "Task not found."
- AI merge: reminders compared by meaning (Daily/Weekly/Before survive unrelated additions), corrections replace earlier additions, no stray punctuation, a clarified date is kept.
- Cancel: typed words, voice parts (3 → 1, durations too) and a hand-made item's capture contents are taken back; the recording still plays.
- Held proposals: never in the banner or its count, not touched by Discard all, Save after that works. `linkOnly` of a decided proposal no longer fails Save.
- Follow-up review: captured once, closes after Save all, nothing left pending.
- Draft notice: shown only when there is a real unsaved change; "Continue editing" restores it; gone after Save, Cancel, a reverted edit or "Discard my changes".
- Form validation: title length, ongoing + "before" message. Desktop label on one line.
- Regressions nearby: feed typed capture with two items → review → Save all; real pending reviews with Resume / Discard / Discard all; a non-form "Add more" (continue without `keepEarlier`) shows "Unsaved addition to “RC call bank”", resumes into the whole-item review and saves priority High + "30 min before". No console errors (apart from the forced 500), no horizontal overflow at 420 or 1280.

## Not covered / follow-ups
- Emulator not used; mobile was checked by reading code only. The mobile `ItemEditor` mirrors web line for line, so new #1, #2 and #4 apply there too (the #3 server behaviour applies to both).
- A real failing PUT (rather than a forced 500) after a type change, e.g. a server validation error the form doesn't catch: not found one; the form now checks title length first.
- Regression tests worth adding: `ContinuedItem.Keep` with a clarification and unchanged fields (details must not get the words); `saveItemForm` + Cancel after a moved error (client); held proposals without a draft.
