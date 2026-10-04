import { WorkspaceRolesEnum } from "../utils/constants.js";
import { optionalEnum, optionalNonEmptyText, optionalText, requiredEmail, requiredEnum, requiredText } from "./common.js";

// "owner" is never assignable through the API; ownership is set at creation.
const ASSIGNABLE_ROLES = [WorkspaceRolesEnum.ADMIN, WorkspaceRolesEnum.MEMBER, WorkspaceRolesEnum.GUEST];

export const createWorkspaceValidator = () => [requiredText("name", 80), optionalText("description", 500)];

export const updateWorkspaceValidator = () => [optionalNonEmptyText("name", 80), optionalText("description", 500)];

export const inviteWorkspaceMemberValidator = () => [requiredEmail(), optionalEnum("role", ASSIGNABLE_ROLES)];

export const updateWorkspaceMemberRoleValidator = () => [requiredEnum("role", ASSIGNABLE_ROLES)];
