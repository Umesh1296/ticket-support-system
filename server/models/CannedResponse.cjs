const mongoose = require('mongoose')

const CannedResponseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  category: { type: String, default: 'general' },
  created_at: { type: Date, default: Date.now },
})

const CannedResponse = mongoose.model('CannedResponse', CannedResponseSchema)
module.exports = { CannedResponse }
