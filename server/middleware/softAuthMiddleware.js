import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const softProtect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      // Only attempt to verify if the token is a valid-looking string
      if (token && token !== "null" && token !== "undefined") {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id).select("-password");
      }
    } catch (error) {
      // If token is invalid or expired, just ignore it and proceed as an unauthenticated user
      req.user = null;
    }
  }
  next();
};
