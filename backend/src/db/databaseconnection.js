import mongoose from "mongoose";
import logger from "../utils/logger.js";

const connectDB = async () => {
    const isProduction = process.env.NODE_ENV === "production";
    const mongoUri = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/projmanage";

    try {
        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
        logger.info("✅ MongoDB connected successfully");
    } catch (error) {
        if (isProduction) {
            logger.error("❌ FATAL: Production MongoDB connection failed. Halting process to avoid data corruption.", error);
            process.exit(1);
        }

        logger.warn("⚠️ Remote MongoDB connection failed in development, attempting local MongoDB fallback...", error.message);
        try {
            await mongoose.connect("mongodb://127.0.0.1:27017/projmanage", { serverSelectionTimeoutMS: 3000 });
            logger.info("✅ Local development MongoDB connected successfully");
        } catch (localErr) {
            logger.error("❌ Both Remote and Local MongoDB connections failed", localErr);
            process.exit(1);
        }
    }
};

export default connectDB;