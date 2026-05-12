const mongoose = require('mongoose')

const FeedbackSchema = new mongoose.Schema({
  ticket_id: { type: String, required: true, unique: true, index: true },
  operator_id: { type: String, required: true },
  employee_id: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, default: '' },
  created_at: { type: Date, default: Date.now },
})

const Feedback = mongoose.model('Feedback', FeedbackSchema)
module.exports = { Feedback }
