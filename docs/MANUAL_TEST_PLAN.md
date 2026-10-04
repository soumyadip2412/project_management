# Manual test plan — the whole app

A step-by-step script that exercises every screen and action, from signing up to deleting a project. It follows one realistic story: **Alice** creates a workspace and a project, invites **Bob** (developer) and **Cara** (viewer), and the three of them use every feature. Expected results come from the code (routes, validators, controllers and the permission matrix), not from guesses.

Tick each box as you go. Anything that does not match the **Expected** column is a bug: note its number, what you saw and a screenshot.

Automated coverage already exists for part of this (`frontend/e2e/*`, `backend/tests/api/*`). This plan is for a human pass before a demo or release, and for the things automation does not cover yet (drag and drop, comments, sprints, notifications, multi-user permissions in the UI).

---

## 0. Setup

**Recommended: a throwaway environment** (nothing touches Atlas, and you can read every email):

```bash
cd backend  && PORT=8123 npm run e2e:server        # API + empty in-memory MongoDB
cd frontend && npx vite --port 5199 --mode e2e     # app on http://localhost:5199
```

- Emails (verification, password reset) are never sent. Read the newest one for an address at
  `http://localhost:8123/__e2e/last-email?to=<email>` and open the link in it.
- Google/GitHub sign-in does not work here (the callback URL points at :8000). Test it separately with the dev servers (`npm run dev` on both), using the OAuth section of this plan.
- Stopping the API wipes all data. That is the point: every run starts clean.

**Three people, three browser sessions** (they must not share cookies): use a normal window, an incognito window and a second browser (or a second Chrome profile).

| Person | Email | Password | Becomes |
|---|---|---|---|
| Alice | `alice@test.dev` | `Password123` | workspace owner, project manager |
| Bob | `bob@test.dev` | `Password123` | developer |
| Cara | `cara@test.dev` | `Password123` | viewer |
| Dan | `dan@test.dev` | `Password123` | never invited (outsider) |

Keep DevTools open in Alice's window: **Network** with *Preserve log*, and **Console**. Any red console error or unexpected 4xx/5xx during a step is a finding, even if the screen looks fine.

---

## 1. Accounts

| # | Who | Steps | Expected |
|---|---|---|---|
| ☐ 1.1 | — | Open `/` signed out | Landing page stays on `/` (no bounce to `/login`) |
| ☐ 1.2 | Alice | `/register`: submit empty, then a 7-character password, then mismatched confirmation | Inline errors under each field; nothing is sent |
| ☐ 1.3 | Alice | Register properly | Lands on `/dashboard`, greeting shows Alice's name |
| ☐ 1.4 | — | Register again with `alice@test.dev` | Clear "already exists" error, no second account |
| ☐ 1.5 | Bob, Cara, Dan | Register in their own sessions | Each reaches their dashboard |
| ☐ 1.6 | Alice | Settings → Profile | "Email not verified" notice with **Resend verification email** |
| ☐ 1.7 | Alice | Click Resend, open the newest verification link | Toast "Verification email sent"; link page says "Your email address is verified."; notice gone from Settings |
| ☐ 1.8 | Alice | Log out, log in with a wrong password, then the right one | Generic "invalid" error (doesn't say which part was wrong); then dashboard |
| ☐ 1.9 | Bob | Sign out → **Forgot password?** → open the reset link → set `NewPassword456` → sign in | Notice "Your password has been reset"; old password refused; new one works. Use `NewPassword456` for Bob from now on |
| ☐ 1.10 | Bob | Open the same reset link again and submit | "This reset link is invalid or has expired" |

---

## 2. Workspaces

| # | Who | Steps | Expected |
|---|---|---|---|
| ☐ 2.1 | Alice | **Workspaces** → Create workspace, empty name | Validation error, nothing created |
| ☐ 2.2 | Alice | Create "Platform team" with a description | Appears in the list; filter box finds it |
| ☐ 2.3 | Alice | Create a second workspace with the **same name** | Allowed or rejected cleanly — never a 500. (Slugs are unique per owner.) |
| ☐ 2.4 | Alice | Settings → **Workspace**: rename "Platform team" and save | Toast "Workspace saved"; new name shows in Workspaces after reload |
| ☐ 2.5 | Alice | Settings → Workspace → add `bob@test.dev` as **member** | Bob appears in the member list |
| ☐ 2.6 | Alice | Add `nobody@test.dev` (no account) | Clear error, no member added |
| ☐ 2.7 | Alice | Add Bob again | Rejected as already a member |
| ☐ 2.8 | Bob | Open Workspaces | Sees the workspace. **Note:** workspace membership alone does **not** show him its projects (that comes from project membership, section 4) |

---

## 3. Projects

| # | Who | Steps | Expected |
|---|---|---|---|
| ☐ 3.1 | Alice | **Projects** → New project, empty name | Validation error |
| ☐ 3.2 | Alice | Name "Payments", key `1PAY` | Rejected: key must be 2–10 letters/digits starting with a letter |
| ☐ 3.3 | Alice | Name "Payments", key `pay`, description | Created in Alice's first workspace; key shown as **PAY** (uppercased) |
| ☐ 3.4 | Alice | Create "Mobile App" with **no key** | Created with key **MOBILE** (first 6 letters of the name; a number is added if taken) |
| ☐ 3.5 | Alice | Create another project with key `PAY` | Rejected with "already exists" (409): keys are unique within a workspace. Never a 500 |
| ☐ 3.6 | Alice | Top-bar **New project** while already on Projects | New project appears in the list immediately (regression check for D10) |
| ☐ 3.7 | Alice | Projects list: filter by name, key and description; status filter | List narrows correctly; "No projects match these filters" when nothing matches; Clear restores |
| ☐ 3.8 | Alice | Edit "Mobile App" from the list (name + description) → Save changes | Toast "Project updated"; values persist after reload |
| ☐ 3.9 | Alice | Open **Payments** → Overview / Tasks / Sprints / Members / Settings tabs | Every tab loads; URL keeps the tab (reload stays on it) |
| ☐ 3.10 | Alice | Payments → Settings: change description → save | Toast "Project settings saved" |

---

## 4. Members and invitations

| # | Who | Steps | Expected |
|---|---|---|---|
| ☐ 4.1 | Alice | Payments → **Members**: invite `bob@test.dev` as **developer** | "Invitation sent"; Bob is pending, not yet a member |
| ☐ 4.2 | Alice | Invite `cara@test.dev` as **viewer** | Same |
| ☐ 4.3 | Alice | Invite Bob again | "already a member or has a pending invitation" |
| ☐ 4.4 | Alice | Invite `nobody@test.dev` | "No user with this email" |
| ☐ 4.5 | Bob | Dashboard | Invitation banner for Payments; a notification for the invitation in the bell |
| ☐ 4.6 | Bob | **Accept** | Payments appears in Bob's Projects; he can open it |
| ☐ 4.7 | Cara | Accept | Same, as viewer |
| ☐ 4.8 | Alice | Invite Dan as developer; Dan **rejects** | Dan never gets access; Alice can invite him again later |
| ☐ 4.9 | Alice | **Team** page: filter people; send an invitation from here to Dan for "Mobile App" | Same invitation behaviour as 4.1; Dan accepts in his session |
| ☐ 4.10 | Alice | Payments → Members: try to change or remove **herself** (owner) | Refused: the owner must remain a project manager |
| ☐ 4.11 | Alice | Remove Dan from Mobile App (confirm dialog) | Dan disappears; in Dan's session, opening Mobile App now fails (not a member) |

---

## 5. Tasks

| # | Who | Steps | Expected |
|---|---|---|---|
| ☐ 5.1 | Alice | **Tasks** → New task, empty title | Validation error |
| ☐ 5.2 | Alice | Create 4 tasks in Payments with different priorities and statuses | Each gets a sequential key: PAY-1, PAY-2, PAY-3, PAY-4 |
| ☐ 5.3 | Alice | Create a task in Mobile App | Its own sequence (MOBILE-1), not PAY-5 |
| ☐ 5.4 | Alice | Board view | **Seven** columns: Backlog, To Do, In Progress, In Review, QA Testing, Done, Cancelled; each task in its column |
| ☐ 5.5 | Alice | **Drag** PAY-1 from To Do to In Review, then reload | Stays in In Review after reload (no 400) |
| ☐ 5.6 | Alice | Drag a task to Done | Moves; dashboard completion numbers change (section 9) |
| ☐ 5.7 | Alice | List view: sort by key, priority, due; filter by project, status, priority, text | Correct order and filtering; "Clear filters" resets; only one of table/list renders at a time |
| ☐ 5.8 | Alice | Open PAY-2 → edit title, description, priority, due date, **assignee = Bob** → Save | Toast "Task saved"; values persist after reload |
| ☐ 5.9 | Bob | Bell icon | Notification: assigned to PAY-2 |
| ☐ 5.10 | Alice | PAY-2 → add 3 subtasks; tick one done; delete one | Progress updates; changes persist after reload |
| ☐ 5.11 | Alice | Try assigning someone who is **not** a project member (e.g. Dan on Payments) | Not offered, or refused by the server; never saved |
| ☐ 5.12 | Alice | Delete PAY-4 (confirm dialog) | Gone from board and list; opening its old URL shows "not found", not a crash |
| ☐ 5.13 | Alice | Create one more task | Key is **PAY-5** (numbers are never reused) |

---

## 6. Comments, @mentions and notifications

| # | Who | Steps | Expected |
|---|---|---|---|
| ☐ 6.1 | Bob | PAY-2 → comment "Done, can you check @alice?" (use Alice's real username from Settings) | Comment appears with Bob's name and time |
| ☐ 6.2 | Alice | Bell | Unread count up by one: "Bob mentioned you on PAY-2" (a mention replaces the ordinary comment notification, so not two) |
| ☐ 6.3 | Alice | **Mark all as read** | Count goes to zero and stays zero after reload |
| ☐ 6.4 | Cara (viewer) | Comment on PAY-2 | **Allowed**: viewers can comment |
| ☐ 6.5 | Cara | Try to delete Bob's comment | Not possible (button hidden or refused): you can only delete your own |
| ☐ 6.6 | Alice (project manager) | Delete Cara's comment (confirm dialog) | Allowed: managers can moderate |
| ☐ 6.7 | Bob | Change PAY-2 status to In Review | Alice (the task's reporter) is notified of the status change; Bob is not notified of his own action |

---

## 7. Sprints

| # | Who | Steps | Expected |
|---|---|---|---|
| ☐ 7.1 | Alice | Payments → **Sprints** → Create sprint with end date **before** start date | Refused with a clear message |
| ☐ 7.2 | Alice | Create "Sprint 1" (goal, dates) and "Sprint 2" | Both listed as planned |
| ☐ 7.3 | Alice | Put PAY-1, PAY-2, PAY-3 into Sprint 1 (from the sprint view or task detail → Sprint) | They show under Sprint 1 |
| ☐ 7.4 | Alice | **Start** Sprint 1 | Becomes active; team members get a sprint notification |
| ☐ 7.5 | Alice | Start Sprint 2 while Sprint 1 is active | Refused: "Another sprint is already active. Complete it first." |
| ☐ 7.6 | Alice | Mark PAY-1 Done; **Complete** Sprint 1 → leave unfinished work in the backlog | Sprint completed; PAY-2 and PAY-3 leave the sprint and show status **Backlog** (visible in the Backlog column) |
| ☐ 7.7 | Alice | Repeat with Sprint 2 active and a new planned "Sprint 3", completing into **Sprint 3** | Unfinished tasks move to Sprint 3, keeping their status |
| ☐ 7.8 | Alice | Delete a planned sprint (confirm dialog) | Gone; its tasks are not deleted |

---

## 8. Permissions in the UI (three sessions side by side)

The server decides; the UI may hide buttons, but whatever it shows must never succeed for the wrong role.

| # | Who | Try to | Expected |
|---|---|---|---|
| ☐ 8.1 | Cara (viewer) | Create a task in Payments | Refused (button hidden or an error); no task created |
| ☐ 8.2 | Cara | Drag a task to another column / edit its title | Refused; after reload nothing changed |
| ☐ 8.3 | Bob (developer) | Create a task, edit one, move one | Allowed |
| ☐ 8.4 | Bob | Delete a task | Refused (needs team lead, scrum master or project manager) |
| ☐ 8.5 | Bob | Start or complete a sprint | Refused |
| ☐ 8.6 | Bob | Invite or remove a member; change project settings | Refused |
| ☐ 8.7 | Dan (outsider) | Paste Payments' project URL and a task URL from Alice's address bar | "Not a member" / not found. No data is shown |
| ☐ 8.8 | Dan | Global search for "PAY" | Payments' tasks never appear |
| ☐ 8.9 | Bob | Delete the **project** | Refused; only the owner can |
| ☐ 8.10 | Any | While signed in, sign out in another tab of the same browser, then act in the first tab | Sent to `/login`, no hung spinners |

---

## 9. Dashboard

| # | Who | Steps | Expected |
|---|---|---|---|
| ☐ 9.1 | Alice | Dashboard after sections 3–7 | Project/task counts match reality; numbers change after creating or finishing a task |
| ☐ 9.2 | Alice | Activity feed | Shows recent real actions (task created, status changed, sprint started) with who did them |
| ☐ 9.3 | Alice | My tasks / upcoming deadlines | Tasks assigned to her with due dates; overdue ones flagged |
| ☐ 9.4 | New user | Dashboard with no projects | Empty state that tells them what to do next |

---

## 10. Search (⌘K / Ctrl K)

| # | Who | Steps | Expected |
|---|---|---|---|
| ☐ 10.1 | Alice | Press Ctrl K | Focus jumps to the search box |
| ☐ 10.2 | Alice | Search a project name, a task title, an issue key | Results for projects and tasks; Enter/click opens the item |
| ☐ 10.3 | Alice | Search `.*`, `(`, `{"$ne":null}` | No crash, no "everything" result; treated as plain text |

---

## 11. Settings

| # | Who | Steps | Expected |
|---|---|---|---|
| ☐ 11.1 | Alice | Profile: change full name → Save | Toast "Profile saved"; new name in sidebar, comments and member lists |
| ☐ 11.2 | Alice | Password: wrong current password | Error "Invalid current password" |
| ☐ 11.3 | Alice | Sign in as Alice in a second browser; change password in the first | Toast says other devices were signed out; the second browser is sent to `/login` on its next action; the first stays signed in |
| ☐ 11.4 | Alice | Appearance: light / dark / system | Applies instantly, survives reload, no flash of the wrong theme |
| ☐ 11.5 | Alice | Workspace: remove Bob (confirm dialog) | Bob loses the workspace, but **keeps** project access he was given directly |

---

## 12. Data integrity and failure handling

| # | Steps | Expected |
|---|---|---|
| ☐ 12.1 | Reload on every screen above | Same data as before reload: nothing was only optimistic |
| ☐ 12.2 | Open the same task as Alice and Bob; both change the title and save | No crash; last save wins or a clear conflict message (409). Reload shows one consistent value |
| ☐ 12.3 | Stop the API (Ctrl C), then click around | Readable error messages, no blank screens, no infinite spinners. Start the API again (in the throwaway setup, data is gone; that is expected) |
| ☐ 12.4 | Visit `/dashboard/does-not-exist` and `/nonsense` | 404 page with a way back |
| ☐ 12.5 | Alice: delete **Payments** (Settings tab, confirm dialog) | Gone for all three users; its tasks, sprints and comments disappear; opening an old task URL shows not-found. Bob and Cara get a notification |
| ☐ 12.6 | Alice: Dashboard after 12.5 | Counts updated; no errors from the deleted project |

---

## 13. Responsive and accessibility

| # | Steps | Expected |
|---|---|---|
| ☐ 13.1 | DevTools → device toolbar → a 390 px phone; repeat 3.3, 5.2, 5.8, 6.1, 7.4 | Sidebar becomes a drawer (menu button); lists replace tables; no sideways scrolling; dialogs fit the screen |
| ☐ 13.2 | Keyboard only (Tab, Shift+Tab, Enter, Esc): create a project and a task, open and close a dialog | Every control reachable; focus always visible; Esc closes dialogs and returns focus |
| ☐ 13.3 | Dark theme on every screen | Text readable everywhere; status colours still distinguishable |

---

## 14. Google and GitHub sign-in (dev servers on :8000 / :5173)

Run with `npm run dev` in both repos (real database, so clean up afterwards). Before starting, make sure only Project Camp listens on port 8000: `netstat -ano | findstr :8000` (a second process, such as another project's uvicorn, will answer with `{"detail":"Not Found"}`).

| # | Steps | Expected |
|---|---|---|
| ☐ 14.1 | New user: Sign in → Google → pick an account | Lands on `/dashboard`; cookies are HttpOnly; no token in the URL; user has `googleId`, `isEmailVerified: true`, no password |
| ☐ 14.2 | Sign out, Google again | Same account, no duplicate user |
| ☐ 14.3 | Verified password account with the same Gmail → Google | Same account; Google linked; **password still works** |
| ☐ 14.4 | **Unverified** password account with the same Gmail, signed in in tab 1 → Google in tab 2 | Linked; password **removed** (old password fails); tab 1 signed out |
| ☐ 14.5 | Cancel on Google's consent screen (revoke the app first at myaccount.google.com/permissions) | Back on `/login` |
| ☐ 14.6 | Reopen a used `…/google/callback?code=…` URL | **Known gap:** "Internal Server Error" instead of `/login` |
| ☐ 14.7 | Deactivate the Google user (`isActive: false`), sign in with Google | **Known gap:** reaches `/dashboard`, then every request says the account is deactivated. Should be refused at sign-in |
| ☐ 14.8 | More than ~10 sign-in attempts in 15 minutes | 429 Too Many Requests (20 auth requests per 15 minutes; a restart resets it) |
| ☐ 14.9 | GitHub: repeat 14.1–14.4; also an account with a private email | Works the same; private email becomes `<id>@github.oauth` |

---

## 15. Added on 2026-10-04 (board, task fields, members, comments, notes, charts)

| # | Who | Steps | Expected |
|---|---|---|---|
| ☐ 15.1 | Alice | Board: Tab to a card, press Space, → twice, Space | The card moves two columns right; focus stays on it; a screen reader announces each step |
| ☐ 15.2 | Alice | Board: card's ⋯ menu → "Move to Done" | Moves; survives reload |
| ☐ 15.3 | Alice | Phone width: the "Column" picker shows one column at a time; move a card with its menu | No sideways scrolling; the card appears under its new column |
| ☐ 15.4 | Alice | New task with type **Bug** and **5** story points | Card shows the bug glyph and "5" |
| ☐ 15.5 | Alice | Task page: change assignee, points (try 101 first), add and remove labels | 101 is refused with a message; the rest persists after reload |
| ☐ 15.6 | Alice | Members tab: change Bob's role; invite Dan and look under "Waiting to accept" | Toast confirms the role; Dan is listed as pending until he accepts |
| ☐ 15.7 | Bob (developer) | Members tab | Roles as plain text; no remove buttons, no invite form |
| ☐ 15.8 | Bob | Edit his own comment; react 🎉 then remove the reaction | "(edited)" shows; the reaction count goes 1 → 0 |
| ☐ 15.9 | Bob | Look at Alice's comment | No edit or delete buttons |
| ☐ 15.10 | Alice (manager) | Delete Bob's comment | Allowed (moderation) |
| ☐ 15.11 | Alice | A comment with @bob's username | The mention is highlighted; Bob gets "mentioned you" |
| ☐ 15.12 | Bob | Open that notification from the bell | Opens the task; the unread count drops by one |
| ☐ 15.13 | Alice | Notes tab: create (empty first), edit, delete a note | Validation message, then the note appears, is renamed, and is removed |
| ☐ 15.14 | Bob | Notes tab | Can read notes; no New note / edit / delete |
| ☐ 15.15 | Alice | Sprints tab with an active sprint that has story points; finish a task | Burndown drops by that task's points today; arrow keys read each day; "Show data table" matches |
| ☐ 15.16 | Alice | Complete a sprint | Velocity shows a column with the completed points and the average line; the sprint reads "Completed <date>" |
| ☐ 15.17 | Alice | New project with "Scrum"; change it in Settings | Overview shows the chosen methodology |
| ☐ 15.18 | Alice | Dashboard activity | Entries name what they are about ("created PAY-6 …") and link to it |

## Known gaps (expected to fail today)

- 14.6: a failed or replayed OAuth callback shows a 500 instead of returning to `/login`.
- 14.7: the OAuth callback does not check `isActive`.
- Not built at all, so not in this plan: file attachments, time tracking, the admin console.

## Reporting

For each failure write: **step number · who · what you did · what you expected · what happened**, plus a screenshot and any red line from the Console or Network tab (the error body includes a `requestId`, which finds the matching line in `backend/logs/`).
