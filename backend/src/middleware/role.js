// middleware/role.js
module.exports = function(requiredRole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthenticated' });
    }
    const userRole = req.user.role;
    if (Array.isArray(requiredRole)) {
      if (!requiredRole.includes(userRole)) {
        return res.status(403).json({ message: 'Forbidden: insufficient role' });
      }
    } else {
      if (userRole !== requiredRole) {
        return res.status(403).json({ message: 'Forbidden: insufficient role' });
      }
    }
    next();
  };
};
