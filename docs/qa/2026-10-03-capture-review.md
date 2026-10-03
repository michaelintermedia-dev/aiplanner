# QA report - capture-review - 2026-10-03

Scope: typed and spoken capture, several items in one message, nothing-actionable input, clarifications, the review screen (every field, type chips, reminders, Save some / Save all / Cancel), "Add more - keep talking" on saved items (scope, whole-item update, title/created date, type change, item audio, "Play this part", playback speed), Hebrew RTL review once |
Builds: web/mobile/backend at commit b4d57ef |
Environment: QA API :58600, account feedtest (profile timezone Europe/Moscow), Chrome phone (420) and desktop (1280); emulator no (mobile compared by reading the code) |
AI calls used: 15 of 20

## Summary
Most of the capture loop works. Typed and spoken captures, splitting one message into several items, the "nothing actionable becomes a Note" rule, clarifications, every review edit, Save some / Save all / Cancel, and whole-item "Add more" updates (title, created date, priority, time and reminders kept) all behaved correctly. RTL mirrors properly. The worst problems:
(1) On web, leaving the page while the review is open throws the review away with no warning. The capture stays pending on the server, and nothing in the UI leads back to it.
(2) AI clarifications have English sentences hard-coded on the server, so a Hebrew or Russian review mixes languages, and some questions appear twice.
(3) A whole-item update skips the confirm validation, so very long details cause an HTTP 500.
(4) When "Add more" changes the type, the AI's new title is silently dropped, and once the user's new words were lost entirely.
Not covered: the mobile app on a device, a recording with pause/continue on web, and Russian.

## Findings
| # | Severity | Area | Title |
|---|---|---|---|
| 1 | Bug | Review (web) | Leaving the page mid-review silently drops the review; the capture stays pending with no way back |
| 2 | Bug | Clarifications / i18n | Server-made clarifications are always English, so Hebrew/Russian reviews mix languages and some questions repeat |
| 3 | Bug | Add more / confirm | Whole-item updates skip confirm validation: long details cause a 500 (and the SQL error logs the user's text); extra reminders are silently cut to 10 |
| 4 | Bug | Add more / type change | Changing the type via "Add more" discards the AI's new title; in one run the user's new words were lost completely |
| 5 | UX | Review | An event end time earlier than its start silently becomes a 23-hour overnight event |
| 6 | UX | Add more | Speaking an addition to a typed-capture item silently throws the recording away |
| 7 | UX | Add more | Unrelated requests in an addition ("also call mom tonight") vanish with no hint |
| 8 | UX | Add more | Merged details run sentences together and copy instruction words verbatim |
| 9 | UX | Review (continue) | Two chips are "selected" at once in the "Save as" radio group |
| 10 | Polish | Review | "Save 0" button is enabled when every item is unchecked |
| 11 | Polish | Review | Double-clicking Save sends two confirms; the second gets a 409 "modified by another device" |
| 12 | Polish | Add more / type change | After a type change the page refetches the deleted old item (404 in the console) |
| 13 | Polish | Review / Source | Emoji used as icons (🎤, ⌨, ❓) where the rule is Ionicons |
| 14 | Polish | Review (continue) | The read-only title in a whole-item update looks like an editable input |
| 15 | Polish | Item audio | "Play this part" picks the first occurrence of repeated words; clip stop overshoots ~0.5 s at 2x |
| 16 | Polish | Review | Capture summary talks about "the user" in third person |

### 1. Leaving the page mid-review silently drops the review; the capture stays pending with no way back  (Bug, confidence: high)
- Steps: 1. On the feed (web, 420 px), type "Hmm, I wonder why the sky is blue during the day" and press Enter. The review appears. 2. Type something in Details. 3. Tap the Calendar icon in the header (or tap any feed row under the review, or reload), then go Back.
- Expected: the review (and my edits) is still there, or the app warns before leaving. A capture should never dead-end (CLAUDE.md "A capture never dead-ends"; "never lose what was said"). The mobile app keeps the review alive across navigation (CaptureDock wraps the whole app).
- Actual: the review is gone and the capture box is empty. On the server all items stay `PendingReview` forever (`GET /api/captures` shows `pendingCount: 1`), and no web screen lists pending captures or reopens them. For a voice capture, the user has to say it all again. I reproduced this three ways: header icon, feed row then Back, and reload.
- Evidence: `tools/qa/out/s3b-after-back.png`; script `tools/qa/out/s3b.cjs` (output: "review shown: 0", server status `PendingReview`).
- Where: `web/src/components/CaptureBar.tsx` (review state lives in `useState` inside the feed page's CaptureBar); `web/src/pages/FeedPage.tsx:108`.
- Suggestion: keep the open capture at app level, like mobile does, or offer "Resume review" for captures with `pendingCount > 0`.

### 2. Server-made clarifications are always English and some questions repeat  (Bug, confidence: high)
- Steps: 1. Set locale to he-IL. 2. Capture "להתקשר לבנק היום בשבע בבוקר, ופגישה עם דני מתישהו בשבוע הבא" (7 am had already passed).
- Expected: everything in the review is in Hebrew (CLAUDE.md: all UI text is translated; server-made notification texts already are).
- Actual: the clarifications were "This time has already passed - please check the date." and "באיזו שעה הפגישה עם דני בשבוע הבא? What time does it start?". The AI's Hebrew question is followed by the normalizer's English one, which asks the same thing. In English it reads "What time next week should I put the meeting with Bob? What time does it start?", the same question twice. Reproduced in English (s12) and Hebrew (s15).
- Evidence: `tools/qa/out/s15-he-clar.json`, `tools/qa/out/s12-capture.json`, `tools/qa/out/s12-review.png`.
- Where: `backend/src/AiPlanner.Application/Ai/Services/ExtractionNormalizer.cs:117,121,153,202,217,222,229,241,266,273` (hard-coded strings; `Normalize` gets no locale). Mobile shows the same text.
- Suggestion: translate these per locale (like `NotificationTexts`), and skip the generic question when the AI already asked one.

### 3. Whole-item updates skip confirm validation  (Bug, confidence: high)
- Steps: through the API (the web review sends the same shape), confirm a continued capture item with `appendToType/appendToId/replacesItem: true` and a 5,000-character `description`. Then repeat with 30 reminders.
- Expected: 400 with a clear message, the same as a new item (the confirm validator limits description to 4000 and reminders to 10).
- Actual: the long description returns **500 "An unexpected error occurred."**. SQL says "String or binary data would be truncated ... column 'Description'", and the API log contains the truncated user text, which breaks "Don't log user content" (spec section 37). The transaction rolls back, so no data is lost. With 30 reminders the confirm returns 200 and the task silently keeps only 10. This is reachable from the UI: the review's Details box has no length limit, and every "Add more" makes the AI merge the details again, so they keep growing.
- Evidence: `tools/qa/out/s17.cjs` output; `tools/qa/.local/api.log` (DbUpdateException, TaskItems.Description).
- Where: `ConfirmCaptureRequestValidator.cs` (rules only `When(i => i.AppendToId is null)`); `CaptureService.ConfirmAsync`, which only calls `ValidateAsync(... AppendToId is null)`; `ApplyToItemAsync`, which calls `UpdateAsync` without validating. Mobile is affected too, because the server is shared.
- Suggestion: validate replacesItem items like new ones (and the text-only append's joined length).

### 4. Changing the type via "Add more" discards the AI's new title; once the new words were lost  (Bug, confidence: medium)
- Steps: 1. Open the note "Incomplete fragment" (content "Call the pl...", from a voice capture). 2. "Add more", type "Turn this into a task: call the plumber back tomorrow at noon.", then Save.
- Expected: the request becomes a task about calling the plumber back (CLAUDE.md: a type change only when asked, which it was here; title kept).
- Actual: the AI proposed the title "Call plumber back" with `description: null`. The review shows only the old read-only title, and the saved task is "Incomplete fragment", description "Call the pl...", due tomorrow 12:00. The words "call the plumber back" appear nowhere on the item, only in the capture transcript. In a second run ("Call plumber" event: "Make this a task instead: buy a new faucet washer...") the words did reach the details, but the new title "Buy faucet washer" was again silently dropped, leaving a task called "Call plumber" whose job is buying a washer. The title was discarded in both runs; the words were lost in one of two.
- Evidence: `tools/qa/out/s8-after.png`, `s8-continue.json`, `s18-continue.json`, `s18-review.png`.
- Where: `shared/captureDraft.ts` `toConfirmItem` (wholeItem forces `title: target.title`); `CaptureService.ApplyToItemAsync` (null description keeps the old one).
- Suggestion: when the proposed title differs, show it (or append it to the details) so it isn't lost silently.

### 5. An end time before the start silently makes a 23-hour event  (UX, confidence: high)
- Steps: in a review, an event "Lunch with Dana" Tue 13:00-14:00. Change End to 12:00, then Save.
- Expected: a warning, or at least a visible "(next day)".
- Actual: saved as Tue 13:00 to **Wed 12:00** (`endUtc 2026-10-07T09:00Z`), with no hint in the review. This is deliberate ("ends after midnight", `shared/captureDraft.ts` `toConfirmItem`), but a typo creates a day-long event. The edit form (`AppointmentDetailPage.tsx:150`) and mobile do the same.
- Evidence: `tools/qa/out/s2-confirm.json`; `s2-before-save-full.png`.

### 6. Speaking an addition to a typed-capture item throws the recording away  (UX, confidence: high)
- Steps: open a task that came from a typed capture, "Add more - keep talking", record "Bring the yellow slip too", send, Save.
- Actual: the words are merged into the item, but the recording is deleted (`audioParts` stays 0) and nothing tells the user. The "Add more" button has a mic icon and says "keep talking", so they expect it to be kept.
- Evidence: `tools/qa/out/s13-continue-review.png`, script output `parts 0 null`.
- Where: `CaptureService.ContinueAsync` ("A typed capture has no recording to extend: keep the words only").

### 7. Unrelated requests in an addition vanish with no hint  (UX, opinion, confidence: high)
- Steps: on "Pick up package", add "The package is at the branch on Lenina street, it closes at 8. Also call mom tonight."
- Actual: the package text is merged in. "Call mom tonight" doesn't become a task, isn't in the details, and nothing on screen mentions it. It survives only in the capture transcript. This is the intended "strictly that item" rule, but the user gets no signal that part of what they said was ignored.
- Evidence: `tools/qa/out/s6-continue.json`, `s6-review.png`.
- Suggestion: a one-line note such as "Some of this wasn't about this item - capture it separately".

### 8. Merged details run sentences together and copy instruction words  (UX, confidence: high)
- Actual: "for the smoke alarm Get the nine-volt ones, two of them. And remind me at 5 p.m. today." (`s5`) and "Bring ID. Tracking number 12345 The package is at the branch..." (`s6`, `s13`). The old and new text are joined with a space and no sentence break, and commands that were already applied (the reminder) are copied into the details.
- Evidence: `tools/qa/out/s5-continue.json`, `s6-after.json`.

### 9. Two chips "selected" at once in the "Save as" radio group  (UX, confidence: high)
- Actual: in a continue review, "Add to this task" and "Task" are both highlighted and both `aria-checked="true"` inside one `role="radiogroup"`. Mobile does the same (`accessibilityState.selected`).
- Evidence: `tools/qa/out/s5-continue-review.png`.
- Where: `web/src/components/CaptureReview.tsx` intent-chips block.

### 10. "Save 0" button enabled when every item is unchecked  (Polish, confidence: high)
- Actual: the label reads "Save 0" (Hebrew "שמירת 0") and the button is enabled; pressing it rejects everything, the same as Cancel. Same on mobile (shared logic).
- Evidence: `tools/qa/out/s10-save0.png`.

### 11. Double-clicking Save sends two confirm requests  (Polish, confidence: high)
- Actual: the first returns 200; the second returns **409 "This item was modified by another device."** and logs a console error. No duplicates were created (I checked the feed) and the user sees "Saved 4 items.", but the button isn't disabled before the second click lands.
- Evidence: `tools/qa/out/s10.cjs` output.

### 12. After a type change the page refetches the old, deleted item  (Polish, confidence: high)
- Actual: `GET /api/notes/<old id>` and `GET /api/appointments/<old id>` return 404 (console error) between saving and navigating to the new item. Seen in both type-change runs.
- Evidence: `tools/qa/.local/api.log` (two `- 404` lines); `s8`/`s18` console errors.

### 13. Emoji used as icons  (Polish, confidence: high)
- The review badge "🎤 Voice", the source heading "🎤 From a voice capture" / "⌨ From a typed capture", and clarifications prefixed "❓". CLAUDE.md: icons are Ionicons, never emoji. The same applies on mobile (`CaptureReview.tsx:250`).
- Where: `web/src/components/CaptureReview.tsx` (badge, clarification), `web/src/components/SourceCapture.tsx` (h2).

### 14. Read-only title looks editable  (Polish, opinion)
- In a whole-item update the title is a `readOnly` input with the same styling as an editable one. Clicking it does nothing, with no visual cue.
- Evidence: `tools/qa/out/s5-continue-review.png`.

### 15. Item audio clip details  (Polish, confidence: medium)
- When a phrase occurs twice in one recording, the item's clip points to the first occurrence. For example, a trailing "Call the pl..." fragment got the clip 0:00-0:01, which is the start of the recording (`s4-capture.json`; my test audio looped, but a user repeating a phrase would hit the same matching). At 2x speed, "Play its 2 parts" stopped at 12.16 s for a clip ending at 11.67 s (`s14`).

### 16. Summary in the third person  (Polish, opinion)
- "The user wants to call the plumber tomorrow morning..." / "המשתמש ביקש..." is shown to that same user.

## What works well
- Typed multi-item capture: 4 items (task, task with an "At the time" reminder, event with location, note). Correct dates in the profile timezone (Friday = Oct 9, Monday 10:00 = Oct 5).
- Nothing actionable: "I wonder why the sky is blue" became a Note with the user's words, never a dead end.
- Clarifications: past time, vague time, and an impossible date (Feb 30) are flagged. An event without a time blocks Save with a clear message.
- Review edits: title, date, time, priority, details, reminders (presets, Before, Daily; a Before reminder without a time is blocked; notes get no "before" presets). Switching Task/Event/Note keeps the dates. Blank title is blocked. Uncheck shows "Save 2" and then "Saved 2 items."; the rejected item is stored as Rejected. Cancel rejects all.
- Voice on web: tap to record, tap to pause, listen-back preview (WAV), 1.5x speed on the preview, send. Transcript and items are correct.
- "Add more": strictly that item (no new items; other items of the same capture untouched). Title, created date, priority, due time, both reminders, location and description were kept or merged. An event time changed to 11:00 stayed an Event. Wording that suggests a meeting ("meeting Sam at 4 pm tomorrow") did not change the type. An explicit "make it a task" changed the type, and the app navigated to the new id with the created date kept.
- A completed task's paused reminder survives an "Add more" save and comes back on reopen.
- Item audio after an addition: "Play its 2 parts (0:08)" plays exactly those parts and stops. The speed choice (2x) applies to all players and is remembered after a reload.
- Hebrew: `dir=rtl`, the review and reminder editor mirror correctly, no untranslated UI strings (apart from the server clarifications), no overflow at 420 or 1280.
- No page errors at either width apart from the 409/404 noted above.

## Not covered / follow-ups
- Mobile app was not run (no emulator requested). I compared by code: it shares `captureDraft.ts`, so #5, #9 and #10 apply there too; #2 and #3 are server-side; #1 does not apply on mobile (CaptureDock keeps the review across screens).
- Web recording with pause/continue (several takes) was not tested: Chrome's fake mic loops the file, so the transcript would repeat itself. Mobile's multi-segment upload was not tested either.
- Russian captures; the 10-minute limit; mic switching; "Delete recording".
- AI calls: 15 of 20 used.
