const Joi = require('joi');

module.exports.noteSchema = Joi.object({
    note: Joi.object({
        user: Joi.objectId().required(),
        title: Joi.string().required(),
        note: Joi.string().required(),
    }).required(),
})
