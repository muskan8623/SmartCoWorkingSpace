const jwt = require("jsonwebtoken");

const generateToken = (user) => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured.");
  }

  if (!user || !user._id || !user.role) {
    throw new Error("Valid user data is required to generate a token.");
  }

  return jwt.sign(
    {
      userId: user._id.toString(),
      role: user.role,
    },
    secret,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    }
  );
};

module.exports = generateToken;
