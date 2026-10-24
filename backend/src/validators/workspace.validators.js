/**
 * FILE: backend/src/validators/workspace.validators.js
 *
 * Input rules for routes/workspace.routes.js: create/update a workspace
 * (name ≤ 80, description ≤ 500), invite a member by email, and change a
 * member's role.
 *
 * Security detail: only admin | member | guest can be ASSIGNED. Allowing "owner"
 * here would let an admin promote someone (or themselves) to owner and so
 * escalate privileges.
 */
import { WorkspaceRolesEnum } from "../utils/constants.js";
import { optionalEnum, optionalNonEmptyText, optionalText, requiredEmail, requiredEnum, requiredText } from "./common.js";

// "owner" is never assignable through the API; ownership is set at creation.
const ASSIGNABLE_ROLES = [WorkspaceRolesEnum.ADMIN, WorkspaceRolesEnum.MEMBER, WorkspaceRolesEnum.GUEST];

export const createWorkspaceValidator = () => [requiredText("name", 80), optionalText("description", 500)];

export const updateWorkspaceValidator = () => [optionalNonEmptyText("name", 80), optionalText("description", 500)];

export const inviteWorkspaceMemberValidator = () => [requiredEmail(), optionalEnum("role", ASSIGNABLE_ROLES)];

export const updateWorkspaceMemberRoleValidator = () => [requiredEnum("role", ASSIGNABLE_ROLES)];
