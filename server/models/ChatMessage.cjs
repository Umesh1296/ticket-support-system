const mongoose = require('mongoose')

const ChatMessageSchema = new mongoose.Schema({
  ticket_id: { type: String, required: true, index: true },
  sender_type: { type: String, enum: ['customer', 'agent', 'bot', 'system'], required: true },
  sender_id: { type: String, default: null },
  sender_name: { type: String, default: 'System' },
  content: { type: String, required: true },
  is_internal_note: { type: Boolean, default: false },
  attachments: [{ filename: String, url: String }],
  created_at: { type: Date, default: Date.now },
})

const ChatMessage = mongoose.model('ChatMessage', ChatMessageSchema)
module.exports = { ChatMessage }
