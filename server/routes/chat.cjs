const express = require('express')
const { ChatMessage } = require('../models/ChatMessage.cjs')
const { CannedResponse } = require('../models/CannedResponse.cjs')
const { requireRole, ROLES } = require('../auth.cjs')

const DEFAULT_CANNED_RESPONSES = [
  { title: 'Greeting', content: 'Thank you for reaching out! I\'m here to help you resolve this issue. Could you please provide more details?', category: 'general' },
  { title: 'Apology', content: 'I sincerely apologize for the inconvenience. Let me look into this right away and get it sorted for you.', category: 'general' },
  { title: 'Escalation Notice', content: 'I\'ve escalated this to our senior support team. They will review your case with priority and follow up shortly.', category: 'escalation' },
  { title: 'Refund Initiated', content: 'Your refund has been initiated and will reflect in your account within 5-7 business days. Is there anything else I can help with?', category: 'billing' },
  { title: 'Order Update', content: 'I\'ve checked your order status. Let me share the latest update with you.', category: 'order' },
  { title: 'Resolution Confirmation', content: 'I\'m glad we could resolve this for you! If you face any further issues, don\'t hesitate to reach out. Have a great day!', category: 'general' },
  { title: 'Need More Info', content: 'To better assist you, could you please share your order number/account email so I can look up the details?', category: 'general' },
  { title: 'Technical Fix', content: 'Please try clearing your browser cache and reloading the page. If the issue persists, I\'ll escalate this to our technical team.', category: 'technical' },
]

module.exports = function (db) {
  const router = express.Router()

  // Seed canned responses on first load
  ;(async () => {
    try {
      const count = await CannedResponse.countDocuments()
      if (count === 0) {
        await CannedResponse.insertMany(DEFAULT_CANNED_RESPONSES)
        console.log('Seeded default canned responses.')
      }
    } catch (err) {
      console.error('Failed to seed canned responses:', err.message)
    }
  })()

  // GET /api/chat/:ticketId/messages
  router.get('/:ticketId/messages', async (req, res) => {
    try {
      const { ticketId } = req.params
      const showInternal = req.user?.role === 'operator' || req.user?.role === 'manager'
      const query = { ticket_id: ticketId }
      if (!showInternal) {
        query.is_internal_note = { $ne: true }
      }
      const messages = await ChatMessage.find(query).sort({ created_at: 1 }).lean()
      res.json({ success: true, data: messages })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  // POST /api/chat/:ticketId/messages
  router.post('/:ticketId/messages', async (req, res) => {
    try {
      const { ticketId } = req.params
      const { content, is_internal_note, sender_type } = req.body
      if (!content || !content.trim()) {
        return res.status(400).json({ success: false, error: 'Message content is required' })
      }
      const message = new ChatMessage({
        ticket_id: ticketId,
        sender_type: sender_type || (req.user?.role === 'operator' ? 'agent' : req.user?.role === 'employee' ? 'customer' : 'system'),
        sender_id: req.user?.id || null,
        sender_name: req.user?.name || 'Unknown',
        content: content.trim(),
        is_internal_note: Boolean(is_internal_note),
      })
      await message.save()
      res.json({ success: true, data: message.toObject() })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  // GET /api/chat/canned-responses
  router.get('/canned-responses/list', async (req, res) => {
    try {
      const responses = await CannedResponse.find().sort({ category: 1, title: 1 }).lean()
      res.json({ success: true, data: responses })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  return router
}
