# Setu: demo guide

A ready-made team for showing how the app works. Each account below has a different role, so signing in as different people shows how permissions change what someone can see and do.

## Start the demo

```bash
cd backend  && npm run demo     # API on :8000 with an in-memory database, seeded automatically
cd frontend && npm run dev      # app on http://localhost:5173
```

The demo data lives in memory: it resets every time the demo server restarts, so you can't break anything permanently. To add the same team to a running API with a real database instead, run `npm run seed:demo`, which skips seeding if the team already exists.

**Password for every account: `DemoPass123`**

## The team

The workspace is **Acme Fintech**, with two projects:
- **PAY, Payments Platform:** Scrum, with 3 sprints (one completed, one active, one planned).
- **MOB, Mobile App:** Kanban, with no sprints.

| Person | Email | Workspace role | PAY role | MOB role | What this account shows |
|---|---|---|---|---|---|
| Priya Sharma | priya@demo.dev | Owner | Project manager (owner) | Project manager (owner) | Full control: edit projects, manage members, set WIP limits, delete |
| Arjun Mehta | arjun@demo.dev | Admin | Scrum master | — | Runs sprints: start and complete sprints, plan the backlog |
| Neha Gupta | neha@demo.dev | Member | Developer | Developer | Day-to-day work: most issues are assigned to Neha, so "Your work" is full |
| Rohan Das | rohan@demo.dev | Member | QA | QA | Testing: reports bugs, moves issues through QA |
| Kavya Iyer | kavya@demo.dev | Guest | Viewer | Client | Read-only: can comment, but moves and edits are refused |
| Sam Wilson | sam@demo.dev | — | — | Invited (pending) | A new user: unverified email notice and a pending invitation to accept |

## Suggested walkthrough (about 10 minutes)

1. **Priya: the overview.**
   - **Your work:** project cards show each sprint's day progress and an On track / At risk / Off track badge.
   - **Projects ▾ → Payments Platform → Board:**
     - the sprint strip ("Day 15 of 16", points left, health);
     - **By assignee** swimlanes;
     - card moves by drag, by keyboard, or with the ⋯ menu.
   - **Project settings → WIP limits:** set *In Progress* to 1. Back on the Board, that column turns red and shows "2 / 1".
2. **Arjun: planning.**
   - **Backlog:** Sprint 3 warns "18 pts planned · team averages 13".
   - Search the backlog, move an issue between sprints with ⋯ → *Move to …*, then **Start sprint** or **Complete sprint**.
   - **Reports:** burndown for Sprint 2, and velocity from Sprint 1.
3. **Neha: doing the work.**
   - **Your work → Assigned to me / Due soon.**
   - Open **PAY-7**:
     - change the status from the lozenge;
     - edit the Sprint or Due date directly in Details;
     - add a subtask or a child issue;
     - open **History** to see every status change.
4. **Rohan: testing.** Open **PAY-8**, which is in QA Testing. Comment with an `@mention` (for example `@neha`) and check the notification bell when signed in as Neha.
5. **Kavya: read-only access.** Open the PAY Board and try *Move to Done* on a card. The card snaps back and an error explains the role isn't allowed. Comments still work.
6. **Sam: first run.** Sam's account shows the "verify your email" notice and a pending invitation on Your work. Accept it, and Mobile App appears in the sidebar's Recent projects.

## Good to know

- **Global search:** press Ctrl/⌘ K anywhere.
- **+ Create** in the top bar creates an issue in the project you're viewing.
- **Phones:** under 1024px the ☰ button opens one drawer with all navigation. The board shows one column at a time.
- **Theme:** Account menu (avatar, top right) → Light / Dark / System.
