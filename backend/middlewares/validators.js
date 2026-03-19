const Joi = require('joi');
const { error } = require('../utils/response');

const startScanSchema = Joi.object({
  walletCount: Joi.number().integer().min(1).max(50000).default(3000),
  apiKey: Joi.string().allow('').default(''),
  mode: Joi.string().valid('random', 'sequential', 'mnemonic').default('random'),
  chains: Joi.array().items(Joi.string().valid(
    'ETH CHAIN', 'BNB CHAIN', 'POLYGON CHAIN', 'OPTIMISM CHAIN'
  )).min(1).default(['BNB CHAIN']),
  tokens: Joi.array().items(Joi.string()).min(1).default(['USDT']),
  startIndex: Joi.alternatives().try(Joi.number(), Joi.string()).default(1),
  targetAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).allow('').default('')
});

function validate(schema) {
  return (req, res, next) => {
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });
    if (validationError) {
      return error(res, validationError.details[0].message, 400);
    }
    req.body = value;
    next();
  };
}

module.exports = {
  validate,
  startScanSchema
};
