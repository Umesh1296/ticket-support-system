const mongoose = require('mongoose')

const WorkLogSchema = new mongoose.Schema({
  ticket_id: { type: String, required: true, index: true },
  operator_id: { type: String, required: true },
  operator_name: { type: String, required: true },
  diagnosis: { type: String, required: true },       // "What was the issue?"
  resolution: { type: String, required: true },       // "How did you fix it?"
  parts_changed: { type: String, default: 'N/A' },    // "Monitor replaced", "Cable repaired"
  service_type: { type: String, required: true, enum: ['replacement', 'repair', 'configuration', 'software_fix', 'inspection', 'other'] },
  time_spent_minutes: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  created_at: { type: Date, default: Date.now },
})

const WorkLog = mongoose.model('WorkLog', WorkLogSchema)
module.exports = { WorkLog }
