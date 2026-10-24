/**
 * FILE: backend/src/models/note.models.js
 *
 * PURPOSE
 *   A free-form project note (meeting notes, decisions, specs): a title plus
 *   text content, owned by a project and written by an author.
 *
 * ACCESS
 *   Routes in routes/note.routes.js use authorizeProject("note", <action>).
 *   In utils/permissions.js most roles can only READ notes; managers, scrum
 *   masters and team leads ("note:*") can create, update and delete them.
 *
 * The simplest model in the app: no enums, no hooks, no extra indexes.
 */
import mongoose, { Schema } from "mongoose";

const noteSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    content: {
        type: String,
        required: true
    },
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Project",
        required: true
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
}, { timestamps: true });

export const Note = mongoose.model("Note", noteSchema);
