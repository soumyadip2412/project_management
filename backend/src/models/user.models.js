
import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import crypto from "crypto"
import { AvailableSystemRoles, SystemRolesEnum } from "../utils/constants.js";

const SECRET_FIELDS = [
    "password", "refreshTokenHash", "previousRefreshTokenHash", "refreshRotatedAt", "tokenVersion",
    "forgetPasswordToken", "forgetPasswordExpiry",
    "emailVerificationToken", "emailVerificationExpiry",
    // Legacy: refresh tokens used to be stored in plaintext under this name.
    // It is no longer in the schema, but Mongoose still returns stored fields
    // it does not know about, so strip it from old documents too.
    "refreshToken",
];

const userSchema = new Schema({
    avatar:{
        type: {
            URL:String,
            LocalPath:String
        },
        default:{
            URL:`https://placehold.co/300x200`,
            LocalPath:""
        },
    },
    username:{
        type: String,
        required: true,
        unique: true,
        lowercase:true,
        trim: true,
        index: true
    },
    email:{
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    fullName:{
        type: String,
        required: true,
        trim: true
    },
    // select:false — never loaded unless a query asks for "+password".
    password:{
        type: String,
        select: false,
        required: function() {
            return this.loginType === "EMAIL_PASSWORD" || !this.loginType;
        }
    },
    googleId: {
        type: String
    },
    githubId: {
        type: String
    },
    loginType: {
        type: String,
        enum: ["EMAIL_PASSWORD", "GOOGLE", "GITHUB"],
        default: "EMAIL_PASSWORD"
    },

    // ─── Enterprise Extensions ───────────────
    systemRole: {
        type: String,
        enum: AvailableSystemRoles,
        default: SystemRolesEnum.MEMBER
    },
    department: { type: String, trim: true },
    jobTitle: { type: String, trim: true },
    phone: { type: String, trim: true },
    timezone: { type: String, default: "Asia/Kolkata" },
    locale: { type: String, default: "en" },

    // Activity Tracking
    lastLoginAt: { type: Date },
    loginCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    deactivatedAt: { type: Date },

    // User Preferences
    preferences: {
        theme: {
            type: String,
            enum: ["light", "dark", "system"],
            default: "system"
        },
        notifications: {
            email: { type: Boolean, default: true },
            inApp: { type: Boolean, default: true },
            push: { type: Boolean, default: false }
        },
        defaultProjectView: {
            type: String,
            enum: ["board", "list", "timeline"],
            default: "board"
        },
        density: {
            type: String,
            enum: ["comfortable", "compact"],
            default: "comfortable"
        }
    },

    // ─── Existing Auth Fields ────────────────
    isEmailVerified:{
        type: Boolean,
        default: false
    },
    // SHA-256 of the current refresh token. Only the hash is stored, so a
    // database leak does not hand out usable sessions.
    refreshTokenHash:{
        type: String,
        select: false
    },
    // The hash it replaced, and when. Lets a second browser tab that raced
    // the rotation succeed for a few seconds instead of looking like theft.
    previousRefreshTokenHash:{
        type: String,
        select: false
    },
    refreshRotatedAt:{
        type: Date,
        select: false
    },
    // Embedded in every JWT as "tv". Incrementing it invalidates every token
    // already issued (logout, password change, deactivation, role change),
    // including access tokens that have not expired yet.
    tokenVersion:{
        type: Number,
        default: 0
    },
    forgetPasswordToken:{
        type: String,
        select: false
    },
    forgetPasswordExpiry:{
        type: Date,
        select: false
    },
    emailVerificationToken:{
        type: String,
        select: false
    },
    emailVerificationExpiry:{
        type: Date,
        select: false
    }
},
{
    timestamps: true,
    // Second layer of defence: even if a query explicitly loaded a secret,
    // it is stripped whenever the document is serialised to JSON.
    toJSON: {
        transform: (doc, ret) => {
            for (const field of SECRET_FIELDS) delete ret[field];
            return ret;
        }
    }
}
)

// ─── Indexes ─────────────────────────────────
userSchema.index({ systemRole: 1 });
userSchema.index({ isActive: 1, systemRole: 1 });

// ─── Existing Methods (preserved) ────────────
userSchema.pre("save", async function(next){
    if(!this.isModified("password")) return next()
    this.password = await bcrypt.hash(this.password,10)
    next()
})
// Requires the document to have been loaded with "+password".
userSchema.methods.isPasswordCorrect = async function (password){
    if (!this.password) return false // OAuth-only account
    return bcrypt.compare(password, this.password)
}

// Tokens carry only the user id and the token version. Role and status are
// read from the database on every request, so they are never stale.
// jwtid (a random "jti" claim) makes every token unique: HS256 is
// deterministic and "iat" has one-second resolution, so two tokens minted for
// the same user in the same second were byte-identical, and "rotating" a
// refresh token could hand back the very token it was meant to replace.
userSchema.methods.generateAccessToken = function(){
    return jwt.sign(
        { _id: this._id, tv: this.tokenVersion },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRY, jwtid: crypto.randomUUID() }
    )
}

userSchema.methods.generateRefreshToken = function(){
    return jwt.sign(
        { _id: this._id, tv: this.tokenVersion },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRY, jwtid: crypto.randomUUID() }
    )
}

/** Invalidates every issued access and refresh token for this user. */
userSchema.methods.revokeSessions = function(){
    this.tokenVersion = (this.tokenVersion ?? 0) + 1
    this.refreshTokenHash = undefined
    this.previousRefreshTokenHash = undefined
}

userSchema.methods.generateTempToken=function(){
    const unHashedToken= crypto.randomBytes(20).toString("hex")

    const HashedToken = crypto
    .createHash("sha256")
    .update(unHashedToken)
    .digest("hex")


    const tokenExpiry = Date.now() + (20*60*1000) //20mins
    return{unHashedToken,HashedToken,tokenExpiry}
}

export const User = mongoose.model("User", userSchema)