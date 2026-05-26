const notFound = (req, res, next) => {
  res.status(404);
  next(new Error(`Route not found: ${req.originalUrl}`));
};

const errorHandler = (error, req, res, next) => {
  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

  if (error.name === "ValidationError") {
    res.status(400).json({ message: error.message });
    return;
  }

  if (error.name === "CastError") {
    res.status(400).json({ message: "Invalid resource id" });
    return;
  }

  if (error.code === 11000) {
    res.status(409).json({ message: "Email is already registered" });
    return;
  }

  if (error.code === "LIMIT_FILE_SIZE") {
    res.status(400).json({ message: "File must be 10MB or smaller" });
    return;
  }

  if (error.code === "LIMIT_UNEXPECTED_FILE") {
    res.status(400).json({ message: "Unexpected file field; use field name \"file\"" });
    return;
  }

  if (typeof error.message === "string" && error.message.startsWith("Unsupported file type")) {
    res.status(400).json({ message: error.message });
    return;
  }

  res.status(statusCode).json({
    message: error.message || "Server error",
  });
};

export { errorHandler, notFound };
