import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { anon, startApi, stopApi } from "./setup.js";

before(startApi);
after(stopApi);

// startApi sets NODE_ENV=test, so the docs are on. The production switch is the
// one-line condition `NODE_ENV !== "production" || ENABLE_API_DOCS === "true"` in app.js.
test("Swagger UI is served outside production", async () => {
    const res = await anon().get("/api-docs/");
    assert.ok([200, 301].includes(res.status), `status ${res.status}`);
});
