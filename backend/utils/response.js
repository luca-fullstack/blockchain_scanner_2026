function success(res, data, message = 'success', statusCode = 200) {
  return res.status(statusCode).json({
    code: statusCode,
    message,
    dataResponse: data
  });
}

function error(res, message = 'Internal server error', statusCode = 500) {
  return res.status(statusCode).json({
    code: statusCode,
    message,
    dataResponse: null
  });
}

module.exports = { success, error };
