import mongoose from "mongoose";
import dotenv from "dotenv";
import connectDB from "./db/databaseconnection.js";
import { User } from "./models/user.models.js";
import Project from "./models/project.models.js";
import Workspace from "./models/workspace.models.js";
import {
    ProjectRolesEnum,
    WorkspaceRolesEnum,
    DEFAULT_BOARD_COLUMNS,
} from "./utils/constants.js";

// Load environment variables since this is a standalone script
dotenv.config();

const SEED_PASSWORD = "password123";
const PROJECT_COUNT = 12;
const USER_COUNT = 5;

/**
 * This script DELETES all users, workspaces and projects before reseeding.
 * Two guards stand in front of that, because it previously ran unconditionally
 * against whatever MONGO_URL happened to be configured.
 */
const assertSafeToWipe = () => {
    if (process.env.NODE_ENV === "production") {
        console.error("Refusing to seed: NODE_ENV is \"production\".");
        process.exit(1);
    }

    const confirmed =
        process.env.SEED_CONFIRM === "true" || process.argv.includes("--force");

    if (!confirmed) {
        console.error(
            "Refusing to seed: this deletes ALL users, workspaces and projects.\n" +
            "Re-run with --force (or SEED_CONFIRM=true) if that is what you want:\n" +
            "  npm run seed -- --force"
        );
        process.exit(1);
    }
};

const seedDatabase = async () => {
    assertSafeToWipe();

    try {
        await connectDB();

        console.log(`Seeding database "${mongoose.connection.name}"…`);

        console.log("Clearing existing data…");
        await Promise.all([
            User.deleteMany({}),
            Workspace.deleteMany({}),
            Project.deleteMany({}),
        ]);

        console.log("Creating users…");
        const users = [];
        for (let i = 1; i <= USER_COUNT; i++) {
            users.push({
                username: `user${i}`,
                email: `user${i}@example.com`,
                fullName: `Test User ${i}`,
                password: SEED_PASSWORD,
                isEmailVerified: true,
            });
        }
        // User.create (not insertMany) so the pre('save') hook hashes passwords.
        const createdUsers = await User.create(users);
        console.log(`✅ ${createdUsers.length} users created.`);

        const owner = createdUsers[0];

        // A Project requires a workspace, so the workspace has to exist first.
        console.log("Creating workspace…");
        const workspace = await Workspace.create({
            name: "Seed Workspace",
            slug: "seed-workspace",
            description: "Workspace created by the seed script.",
            owner: owner._id,
            members: createdUsers.map((user, idx) => ({
                user: user._id,
                role: idx === 0 ? WorkspaceRolesEnum.OWNER : WorkspaceRolesEnum.MEMBER,
            })),
        });
        console.log(`✅ workspace "${workspace.name}" created.`);

        console.log("Creating projects…");
        const projects = [];
        for (let i = 1; i <= PROJECT_COUNT; i++) {
            const projectOwner = createdUsers[i % createdUsers.length];
            const otherMembers = createdUsers
                .filter((u) => !u._id.equals(projectOwner._id))
                .slice(0, 2)
                .map((u) => ({ user: u._id, role: ProjectRolesEnum.DEVELOPER }));

            projects.push({
                name: `Project Alpha ${i}`,
                description:
                    `Seeded project ${i}, used to exercise list layouts, pagination and board views.`,
                owner: projectOwner._id,
                // Both required by the Project schema; omitting them is why the
                // previous version of this script always failed validation.
                workspace: workspace._id,
                key: `ALPHA${i}`,
                lead: projectOwner._id,
                members: [
                    // "admin" is NOT a valid project role — see AvailableProjectRoles.
                    { user: projectOwner._id, role: ProjectRolesEnum.PROJECT_MANAGER },
                    ...otherMembers,
                ],
                boardColumns: DEFAULT_BOARD_COLUMNS,
            });
        }

        const createdProjects = await Project.insertMany(projects);
        console.log(`✅ ${createdProjects.length} projects created.`);

        console.log(
            `\n🎉 Seeding complete. Sign in as ${createdUsers[0].email} / ${SEED_PASSWORD}`
        );
        process.exit(0);
    } catch (error) {
        console.error("❌ Seeding failed:", error);
        process.exit(1);
    }
};

seedDatabase();
