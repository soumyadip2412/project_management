import { Note } from "../models/note.models.js";
import { ApiError } from "../utils/api-errors.js";
import { ApiResponse } from "../utils/api-response.js";
import { asynchandler } from "../utils/asynchandler.js";

// All handlers run after authorizeProject("note", ...): reading notes needs
// note:read (every project role), writing needs note:create/update/delete
// (project leads). The controllers used to re-implement that check by hand.

const createNote = asynchandler(async (req, res) => {
    const { title, content } = req.body;
    const note = await Note.create({ title, content, project: req.project._id, author: req.user._id });
    return res.status(201).json(new ApiResponse(201, note, "Note created successfully"));
});

const getProjectNotes = asynchandler(async (req, res) => {
    const notes = await Note.find({ project: req.project._id })
        .populate("author", "fullName username email")
        .sort({ createdAt: -1 });
    return res.status(200).json(new ApiResponse(200, notes, "Project notes fetched successfully"));
});

const getNoteById = asynchandler(async (req, res) => {
    const note = await Note.findOne({ _id: req.params.noteId, project: req.project._id })
        .populate("author", "fullName username email");
    if (!note) throw new ApiError(404, "Note not found");
    return res.status(200).json(new ApiResponse(200, note, "Note fetched successfully"));
});

const updateNote = asynchandler(async (req, res) => {
    const { title, content } = req.body;
    const update = {};
    if (title !== undefined) update.title = title;
    if (content !== undefined) update.content = content;

    const note = await Note.findOneAndUpdate(
        { _id: req.params.noteId, project: req.project._id },
        { $set: update },
        { new: true, runValidators: true }
    );
    if (!note) throw new ApiError(404, "Note not found");
    return res.status(200).json(new ApiResponse(200, note, "Note updated successfully"));
});

const deleteNote = asynchandler(async (req, res) => {
    const note = await Note.findOneAndDelete({ _id: req.params.noteId, project: req.project._id });
    if (!note) throw new ApiError(404, "Note not found");
    return res.status(200).json(new ApiResponse(200, null, "Note deleted successfully"));
});

export { createNote, getProjectNotes, getNoteById, updateNote, deleteNote };
