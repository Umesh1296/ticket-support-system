const mongoose = require('mongoose')

const AuditEventSchema = new mongoose.Schema({
  operator_id: { type: String, required: true, index: true },
  operator_name: { type: String },
  operator_email: { type: String },
  event_type: {
    type: String,
    enum: ['ticket_accepted', 'ticket_resolved', 'ticket_closed', 'ticket_transferred', 'ticket_missed', 'status_change', 'login', 'logout', 'feedback_submitted'],
    required: true,
  },
  ticket_id: { type: String, default: null },
  ticket_title: { type: String, default: null },
  details: { type: String, default: '' },
  resolution_time_ms: { type: Number, default: null },
  csat_score: { type: Number, default: null, min: 1, max: 5 },
  created_at: { type: Date, default: Date.now },
})

const AuditEvent = mongoose.model('AuditEvent', AuditEventSchema)
module.exports = { AuditEvent }
