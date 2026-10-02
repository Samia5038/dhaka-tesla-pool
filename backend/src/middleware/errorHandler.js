const HttpError = require('../httpError');

function notFound(req, res, next) {
  next(new HttpError(404, 'Route not found'));
}

function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({
    error: status === 500 ? 'Internal server error' : err.message,
  });
}

module.exports = { notFound, errorHandler };
