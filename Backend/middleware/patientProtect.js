const jwt = require('jsonwebtoken');

module.exports = function patientProtect(req, res, next) {
   let token;
   const authHeader = req.headers.authorization;

   if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
   }

   if (!token) {
      return res.status(401).json({ message: 'Not authorized, no token' });
   }

   try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role !== 'patient') {
         return res.status(401).json({ message: 'Not authorized as patient' });
      }
      req.user = { id: decoded.id };
      next();
   } catch (err) {
      return res.status(401).json({ message: 'Not authorized, token failed' });
   }
};