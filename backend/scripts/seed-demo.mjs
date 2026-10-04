/**
 * Demo data: a small team with two projects, created THROUGH THE API.
 *
 * Every step is a real HTTP request made as the person who would do it
 * (Priya creates the project, Neha moves her task, Rohan reports the bug), so
 * issue numbers, notifications, the activity feed and the audit log are all
 * genuine. Nothing is written to the database directly and nothing is deleted.
 *
 * Usage:
 *   npm run demo                     in-memory API on :8000, seeded on start (nothing persists)
 *   npm run seed:demo                seed a running API (default http://localhost:8000)
 *   API_URL=http://localhost:8123 npm run seed:demo
 *
 * Running it twice is safe: if Priya already has the PAY project it stops.
 */

export const DEMO_PASSWORD = "DemoPass123";

export const DEMO_USERS = {
    priya: { fullName: "Priya Sharma", email: "priya@demo.dev", username: "priya" },
    arjun: { fullName: "Arjun Mehta", email: "arjun@demo.dev", username: "arjun" },
    neha: { fullName: "Neha Gupta", email: "neha@demo.dev", username: "neha" },
    rohan: { fullName: "Rohan Das", email: "rohan@demo.dev", username: "rohan" },
    kavya: { fullName: "Kavya Iyer", email: "kavya@demo.dev", username: "kavya" },
    sam: { fullName: "Sam Wilson", email: "sam@demo.dev", username: "sam_wilson" },
};

const days = (n) => new Date(Date.now() + n * 86_400_000).toISOString();

/** One signed-in person: keeps their cookies between requests, like a browser. */
class Session {
    constructor(api, name) {
        this.api = api;
        this.name = name;
        this.cookies = new Map();
    }

    async request(method, path, body) {
        const res = await fetch(`${this.api}/api/v1${path}`, {
            method,
            headers: {
                "Content-Type": "application/json",
                Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "),
            },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        for (const c of res.headers.getSetCookie?.() ?? []) {
            const [pair] = c.split(";");
            const i = pair.indexOf("=");
            this.cookies.set(pair.slice(0, i), pair.slice(i + 1));
        }
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err = new Error(`${this.name}: ${method} ${path} → ${res.status} ${json.message ?? ""}`);
            err.status = res.status;
            throw err;
        }
        return json.data ?? json;
    }

    get = (p) => this.request("GET", p);
    post = (p, b = {}) => this.request("POST", p, b);
    put = (p, b) => this.request("PUT", p, b);
}

async function signIn(api, key) {
    const u = DEMO_USERS[key];
    const s = new Session(api, u.fullName);
    try {
        await s.post("/auth/register", { ...u, password: DEMO_PASSWORD });
    } catch (err) {
        if (err.status !== 409) throw err; // 409: already registered on an earlier run
    }
    const { user } = await s.post("/auth/login", { email: u.email, password: DEMO_PASSWORD });
    s.user = user;
    return s;
}

/** On the in-memory E2E server, open each verification link from the test outbox. */
async function verifyEmails(api, sessions) {
    for (const s of sessions) {
        const res = await fetch(`${api}/__e2e/last-email?to=${encodeURIComponent(s.user.email)}`).catch(() => null);
        if (!res?.ok) return false; // not the E2E server (real mail): leave verification to the user
        const token = (await res.json()).text.match(/verify-email\/([A-Za-z0-9]+)/)?.[1];
        if (token) await s.get(`/auth/verify-email/${token}`).catch(() => {});
    }
    return true;
}

export async function seedDemo(api = "http://localhost:8000", log = console.log) {
    const priya = await signIn(api, "priya");
    if ((await priya.get("/projects")).some((p) => p.key === "PAY")) {
        log("[demo] already seeded (Priya has PAY); nothing to do");
        return;
    }

    const [arjun, neha, rohan, kavya, sam] = await Promise.all(
        ["arjun", "neha", "rohan", "kavya", "sam"].map((k) => signIn(api, k)),
    );
    // Sam stays unverified so the "verify your email" notice can be shown.
    const verified = await verifyEmails(api, [priya, arjun, neha, rohan, kavya]);

    // ─── Workspace ───────────────────────────────────────────────────────────
    const ws = await priya.post("/workspaces", {
        name: "Acme Fintech",
        description: "Product and engineering for Acme's payments business.",
    });
    for (const [s, role] of [[arjun, "admin"], [neha, "member"], [rohan, "member"], [kavya, "guest"]]) {
        await priya.post(`/workspaces/${ws._id}/invite`, { email: s.user.email, role });
    }

    // ─── Projects and members (invitations accepted by each person) ──────────
    const pay = await priya.post("/projects", {
        name: "Payments Platform",
        methodology: "scrum",
        key: "PAY",
        description: "Card checkout, refunds and webhooks for the Acme web store.",
        workspaceId: ws._id,
    });
    const mob = await priya.post("/projects", {
        name: "Mobile App",
        key: "MOB",
        description: "The iOS and Android shopping app.",
        workspaceId: ws._id,
    });

    const join = async (project, s, role) => {
        await priya.post(`/projects/${project._id}/members`, { email: s.user.email, role });
        await s.post(`/projects/${project._id}/invitations/accept`);
    };
    await join(pay, arjun, "scrum_master");
    await join(pay, neha, "developer");
    await join(pay, rohan, "qa");
    await join(pay, kavya, "viewer");
    await join(mob, neha, "developer");
    await join(mob, rohan, "qa");
    await join(mob, kavya, "client");
    // Left pending on purpose: Sam sees an invitation on his dashboard.
    await priya.post(`/projects/${mob._id}/members`, { email: sam.user.email, role: "developer" });

    const id = (s) => s.user._id;
    const task = (s, project, fields) => s.post(`/tasks/${project._id}`, fields);
    const update = (s, project, t, fields) => s.put(`/tasks/${project._id}/t/${t._id}`, fields);
    const comment = (s, project, t, body) => s.post(`/projects/${project._id}/tasks/${t._id}/comments`, { body });
    const sprintPath = `/projects/${pay._id}/sprints`;

    // ─── Payments: three sprints ─────────────────────────────────────────────
    const s1 = await arjun.post(sprintPath, {
        name: "Sprint 1", goal: "Take a test card payment end to end.",
        startDate: days(-28), endDate: days(-15),
    });
    const s2 = await arjun.post(sprintPath, {
        name: "Sprint 2", goal: "Ship checkout and refunds to beta customers.",
        startDate: days(-14), endDate: days(1),
    });
    const s3 = await arjun.post(sprintPath, {
        name: "Sprint 3", goal: "Wallet payments and invoices.",
        startDate: days(2), endDate: days(15),
    });

    // Sprint 1 work
    const p1 = await task(priya, pay, { title: "Set up Stripe sandbox and API keys", issueType: "task", priority: "high", storyPoints: 3, assignees: [id(neha)], sprint: s1._id, status: "todo" });
    const p2 = await task(priya, pay, { title: "Design the payment intent data model", issueType: "story", priority: "high", storyPoints: 5, assignees: [id(neha)], sprint: s1._id, status: "todo", description: "One record per checkout attempt, linked to the order. Must survive retries without creating a second charge." });
    const p3 = await task(priya, pay, { title: "Verify webhook signatures", issueType: "story", priority: "critical", storyPoints: 5, assignees: [id(neha)], sprint: s1._id, status: "todo" });
    const p4 = await task(priya, pay, { title: "Retry failed webhook deliveries with backoff", issueType: "story", priority: "medium", storyPoints: 5, assignees: [id(neha)], sprint: s1._id, status: "todo" });

    await arjun.post(`${sprintPath}/${s1._id}/start`);
    for (const t of [p1, p2, p3]) await update(neha, pay, t, { status: "done" });
    await update(neha, pay, p4, { status: "in_progress" });
    // Unfinished work rolls into Sprint 2.
    await arjun.post(`${sprintPath}/${s1._id}/complete`, { moveIncompleteToSprint: s2._id });

    // Sprint 2 work (active)
    const p5 = await task(priya, pay, { title: "Checkout page: card form with validation", issueType: "story", priority: "high", storyPoints: 8, assignees: [id(neha)], sprint: s2._id, status: "todo", dueDate: days(3), description: "Card number, expiry and CVC with inline errors. Uses the payment intent from PAY-2." });
    const p6 = await task(priya, pay, { title: "Partial refunds from the order page", issueType: "story", priority: "medium", storyPoints: 5, assignees: [id(neha)], sprint: s2._id, status: "todo", dueDate: days(6) });
    const p7 = await task(rohan, pay, { title: "Customer charged twice when Pay is double-clicked", issueType: "bug", priority: "critical", storyPoints: 3, assignees: [id(neha)], sprint: s2._id, status: "todo", dueDate: days(-1), description: "Steps: open checkout on a slow connection, double-click Pay. Two charges appear in the Stripe dashboard within ~300 ms." });
    const p8 = await task(arjun, pay, { title: "Regression tests for refund edge cases", issueType: "task", priority: "medium", storyPoints: 3, assignees: [id(rohan)], sprint: s2._id, status: "todo", dueDate: days(1) });
    await arjun.post(`${sprintPath}/${s2._id}/start`);

    await update(neha, pay, p5, { status: "in_progress" });
    await update(neha, pay, p7, { status: "in_progress" });
    await update(neha, pay, p7, { status: "in_review" });
    await update(rohan, pay, p8, { status: "qa_testing" });

    for (const [title, status] of [["Card number field with Luhn check", "done"], ["Expiry and CVC validation", "in_progress"], ["Error states and copy", "todo"]]) {
        await neha.post(`/tasks/${pay._id}/t/${p5._id}/subtasks`, { title, status });
    }

    await comment(rohan, pay, p7, "Reproduced on staging: two charges 280 ms apart. Video in the description. @neha");
    await comment(neha, pay, p7, "Fixed with an idempotency key per checkout session, so a second click reuses the first payment intent. Ready for review @arjun");
    await comment(arjun, pay, p7, "Code looks good. @rohan can you retest on staging before we close it?");
    await comment(priya, pay, p5, "Let's keep the error copy consistent with the design system. @neha");
    await comment(kavya, pay, p6, "Customers ask for this every week. Is it still on track for this sprint?");

    // Sprint 3 (planned), backlog and a cancelled idea
    await task(priya, pay, { title: "Apple Pay and Google Pay", issueType: "epic", priority: "high", storyPoints: 13, sprint: s3._id, status: "todo" });
    await task(priya, pay, { title: "Generate invoice PDFs after payment", issueType: "story", priority: "medium", storyPoints: 5, sprint: s3._id, status: "todo" });
    await task(arjun, pay, { title: "Multi-currency settlement report", issueType: "improvement", priority: "low", status: "backlog" });
    await task(rohan, pay, { title: "Webhook test is flaky on CI", issueType: "bug", priority: "low", status: "backlog", assignees: [id(rohan)] });
    await task(priya, pay, { title: "Support the legacy PayPal Classic API", issueType: "task", priority: "none", status: "cancelled", description: "Dropped: PayPal is retiring the Classic API." });

    // ─── Mobile App (kanban, no sprints) ─────────────────────────────────────
    const m1 = await task(priya, mob, { title: "Onboarding screens", issueType: "story", priority: "high", assignees: [id(neha)], status: "todo", dueDate: days(4) });
    await update(neha, mob, m1, { status: "in_progress" });
    await task(rohan, mob, { title: "App crashes on Android 12 when the camera opens", issueType: "bug", priority: "high", assignees: [id(neha)], status: "todo", dueDate: days(2) });
    await task(priya, mob, { title: "Ask for push notification permission at the right moment", issueType: "task", priority: "medium", status: "todo" });
    await task(priya, mob, { title: "App Store screenshots", issueType: "task", priority: "low", assignees: [id(priya)], status: "done" });
    await comment(kavya, mob, m1, "Can we see onboarding on a real device this week? @priya");

    log("[demo] seeded: workspace Acme Fintech, projects PAY and MOB, 3 sprints, 17 tasks");
    log(`[demo] password for every account: ${DEMO_PASSWORD}`);
    for (const u of Object.values(DEMO_USERS)) log(`[demo]   ${u.email.padEnd(16)} ${u.fullName}`);
    if (!verified) log("[demo] emails were not auto-verified (not the in-memory server)");
}

// CLI: `node scripts/seed-demo.mjs`
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv[1]?.endsWith("seed-demo.mjs")) {
    seedDemo(process.env.API_URL || "http://localhost:8000").catch((err) => {
        console.error(`[demo] failed: ${err.message}`);
        process.exit(1);
    });
}
