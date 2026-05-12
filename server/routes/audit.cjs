const express = require('express')
const { AuditEvent } = require('../models/AuditEvent.cjs')
const { ChatMessage } = require('../models/ChatMessage.cjs')
const { requireRole, ROLES } = require('../auth.cjs')

module.exports = function (db) {
  const router = express.Router()

  // Managers and Super Admins can access audit
  router.use(requireRole(ROLES.manager, ROLES.super_admin))

  // GET /api/audit/operators — aggregated stats for all operators
  router.get('/operators', async (req, res) => {
    try {
      let managerId = req.user.id
      if (req.user.role === ROLES.super_admin && req.query.manager_id) {
        managerId = req.query.manager_id
      }

      const operators = await db.getOperators({ manager_id: managerId })
      const allEvents = await AuditEvent.find().lean()

      const stats = operators.map(op => {
        const events = allEvents.filter(e => e.operator_id === op.id)
        const accepted = events.filter(e => e.event_type === 'ticket_accepted').length
        const resolved = events.filter(e => e.event_type === 'ticket_resolved').length
        const missed = events.filter(e => e.event_type === 'ticket_missed').length
        const closed = events.filter(e => e.event_type === 'ticket_closed').length
        const transferred = events.filter(e => e.event_type === 'ticket_transferred').length
        const resolutionTimes = events.filter(e => e.resolution_time_ms).map(e => e.resolution_time_ms)
        const avgResolutionMs = resolutionTimes.length > 0
          ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
          : null
        const csatScores = events.filter(e => e.csat_score).map(e => e.csat_score)
        const avgCsat = csatScores.length > 0
          ? (csatScores.reduce((a, b) => a + b, 0) / csatScores.length).toFixed(1)
          : null

        return {
          id: op.id,
          display_id: op.display_id,
          name: op.name,
          email: op.email,
          status: op.status,
          current_load: op.current_load,
          max_load: op.max_load,
          skills: op.skills,
          tickets_accepted: accepted,
          tickets_resolved: resolved,
          tickets_closed: closed,
          tickets_missed: missed,
          tickets_transferred: transferred,
          avg_resolution_time_ms: avgResolutionMs,
          avg_resolution_time_label: avgResolutionMs
            ? `${Math.round(avgResolutionMs / 60000)}m`
            : 'N/A',
          avg_csat: avgCsat ? parseFloat(avgCsat) : null,
          total_events: events.length,
        }
      })

      res.json({ success: true, data: stats })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  // GET /api/audit/operators/:id/timeline
  router.get('/operators/:id/timeline', async (req, res) => {
    try {
      const events = await AuditEvent.find({ operator_id: req.params.id })
        .sort({ created_at: -1 })
        .limit(100)
        .lean()
      res.json({ success: true, data: events })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  // GET /api/audit/operators/:id/transcripts
  router.get('/operators/:id/transcripts', async (req, res) => {
    try {
      // Find tickets this operator resolved
      const resolvedEvents = await AuditEvent.find({
        operator_id: req.params.id,
        event_type: { $in: ['ticket_resolved', 'ticket_closed'] },
      }).lean()

      const ticketIds = [...new Set(resolvedEvents.map(e => e.ticket_id).filter(Boolean))]
      const transcripts = []

      for (const ticketId of ticketIds.slice(0, 20)) {
        const messages = await ChatMessage.find({ ticket_id: ticketId }).sort({ created_at: 1 }).lean()
        const ticket = await db.findTicketById(ticketId)
        if (ticket) {
          transcripts.push({
            ticket_id: ticketId,
            ticket_title: ticket.title,
            ticket_priority: ticket.priority,
            ticket_status: ticket.status,
            messages,
          })
        }
      }

      res.json({ success: true, data: transcripts })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  // GET /api/audit/operators/:id/worklogs
  router.get('/operators/:id/worklogs', async (req, res) => {
    try {
      const { WorkLog } = require('../models/WorkLog.cjs')
      const worklogs = await WorkLog.find({ operator_id: req.params.id })
        .sort({ created_at: -1 })
        .limit(20)
        .lean()
      res.json({ success: true, data: worklogs })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  return router
}
