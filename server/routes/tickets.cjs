const express = require('express')
const { v4: uuidv4 } = require('uuid')
const { ROLES } = require('../auth.cjs')
const { autoAssignTicket, calculateSLADeadline, getSLAStatus } = require('../autoAssign.cjs')
const { isSupportedCategory, normalizeCategory } = require('../taxonomy.cjs')
const { WorkLog } = require('../models/WorkLog.cjs')
const { Feedback } = require('../models/Feedback.cjs')
const { AuditEvent } = require('../models/AuditEvent.cjs')

const VALID_PRIORITIES = ['critical', 'high', 'medium', 'low']
const VALID_SERVICE_TYPES = ['replacement', 'repair', 'configuration', 'software_fix', 'inspection', 'other']

// ===== Smart Category Detection =====
const CATEGORY_KEYWORDS = {
  hardware: ['hardware', 'monitor', 'keyboard', 'mouse', 'printer', 'screen', 'cpu', 'ram', 'motherboard', 'fan', 'overheat', 'heat', 'hot', 'power supply', 'laptop', 'desktop', 'device', 'usb', 'port', 'cable', 'battery', 'charger', 'headphone', 'speaker', 'camera', 'webcam', 'broken', 'damaged', 'physical'],
  software: ['software', 'install', 'update', 'crash', 'bug', 'error', 'application', 'app', 'program', 'windows', 'linux', 'mac', 'os', 'operating system', 'driver', 'license', 'antivirus', 'malware', 'virus', 'slow', 'freeze', 'hang', 'not responding', 'blue screen', 'bsod'],
  network: ['network', 'internet', 'wifi', 'wi-fi', 'lan', 'ethernet', 'connection', 'disconnect', 'vpn', 'proxy', 'dns', 'ip address', 'router', 'switch', 'firewall', 'bandwidth', 'speed', 'ping', 'latency', 'packet', 'connectivity', 'offline', 'online'],
  billing: ['billing', 'payment', 'invoice', 'charge', 'refund', 'subscription', 'plan', 'pricing', 'cost', 'fee', 'receipt', 'transaction', 'credit', 'debit', 'renewal', 'cancel', 'upgrade', 'downgrade'],
  account: ['account', 'login', 'password', 'reset', 'access', 'permission', 'role', 'user', 'profile', 'email', 'authentication', 'two-factor', '2fa', 'locked', 'unlock', 'disabled', 'activate', 'deactivate', 'register', 'sign up', 'sign in'],
  infrastructure: ['server', 'database', 'cloud', 'hosting', 'deployment', 'backup', 'restore', 'migration', 'storage', 'disk', 'space', 'capacity', 'load balancer', 'cluster', 'virtual machine', 'vm', 'container', 'docker', 'kubernetes'],
  technical: ['technical', 'support', 'help', 'assist', 'troubleshoot', 'diagnose', 'fix', 'repair', 'service', 'maintenance', 'configure', 'setup', 'integration', 'api', 'data', 'export', 'import'],
}

function detectCategory(title, description) {
  const text = `${title} ${description}`.toLowerCase()
  let bestCategory = 'technical' // default fallback
  let bestScore = 0

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        // Longer keyword matches are worth more
        score += keyword.length
      }
    }
    if (score > bestScore) {
      bestScore = score
      bestCategory = category
    }
  }

  return bestCategory
}

// ===== Smart Priority Detection =====
const PRIORITY_KEYWORDS = {
  critical: ['urgent', 'critical', 'emergency', 'down', 'outage', 'crash', 'data loss', 'security breach', 'not working at all', 'completely broken', 'production down', 'server down', 'cannot access'],
  high: ['important', 'asap', 'high priority', 'blocking', 'stuck', 'broken', 'failing', 'error', 'bug', 'major', 'serious', 'significant'],
  low: ['minor', 'cosmetic', 'low priority', 'when you get a chance', 'no rush', 'nice to have', 'suggestion', 'feature request', 'small', 'trivial'],
}

function detectPriority(title, description) {
  const text = `${title} ${description}`.toLowerCase()

  for (const keyword of PRIORITY_KEYWORDS.critical) {
    if (text.includes(keyword)) return 'critical'
  }
  for (const keyword of PRIORITY_KEYWORDS.high) {
    if (text.includes(keyword)) return 'high'
  }
  for (const keyword of PRIORITY_KEYWORDS.low) {
    if (text.includes(keyword)) return 'low'
  }

  return 'medium' // default
}

function canAccessTicket(user, ticket) {
  if (user.role === ROLES.super_admin) return true
  if (user.role === ROLES.manager) return true
  if (user.role === ROLES.operator) return ticket.assigned_to === user.id
  if (ticket.reporter_user_id) return ticket.reporter_user_id === user.id
  return ticket.reporter_email?.toLowerCase() === user.email.toLowerCase()
}

module.exports = (store) => {
  const router = express.Router()

  const handleResolution = async (ticket, now) => {
    const operator = await store.findOperatorById(ticket.assigned_to)
    if (operator) {
      const nextLoad = Math.max(0, (operator.current_load || 0) - 1)
      await store.updateOperator(operator.id, {
        current_load: nextLoad,
        status: nextLoad < operator.max_load && operator.status !== 'offline' ? 'available' : operator.status,
      })
    }
    await store.insertReport({
      id: uuidv4(),
      manager_id: ticket.manager_id,
      ticket_id: ticket.id,
      ticket: { ...ticket, status: 'resolved', resolved_at: now },
      resolved_at: now,
      operator_name: operator?.name || 'Unknown',
      operator_email: operator?.email || 'Unknown',
      reporter_name: ticket.reporter_name,
      reporter_email: ticket.reporter_email,
      sla_status: getSLAStatus({ ...ticket, status: 'resolved', resolved_at: now })
    })
  }

  // ===== GET all tickets =====
  router.get('/', async (req, res) => {
    try {
      const { status, priority, category, assigned_to } = req.query
      const normalizedCategoryFilter = category ? normalizeCategory(category) : null
      
      let query = {}
      if (req.user.role === ROLES.super_admin && req.query.manager_id) query = { manager_id: req.query.manager_id }
      else if (req.user.role === ROLES.manager) query = { manager_id: req.user.id }
      else if (req.user.role === ROLES.operator || req.user.role === ROLES.employee) query = { manager_id: req.user.manager_id }

      const operators = await store.getOperators(query)
      const operatorsById = new Map(operators.map((operator) => [operator.id, operator]))

      const allTickets = await store.getTickets(query)
      const ticketIds = allTickets.map(t => t.id)
      const feedbacks = await Feedback.find({ ticket_id: { $in: ticketIds } }).lean()
      const feedbackMap = new Map(feedbacks.map(f => [f.ticket_id, f]))

      const tickets = allTickets
        .filter((ticket) => canAccessTicket(req.user, ticket))
        .filter((ticket) => !status || ticket.status === status)
        .filter((ticket) => !priority || ticket.priority === priority)
        .filter((ticket) => !normalizedCategoryFilter || ticket.category === normalizedCategoryFilter)
        .filter((ticket) => !assigned_to || ticket.assigned_to === assigned_to)
        .sort((left, right) => {
          const priorityRank = { critical: 1, high: 2, medium: 3, low: 4 }
          return priorityRank[left.priority] - priorityRank[right.priority] || new Date(right.created_at) - new Date(left.created_at)
        })
        .map((ticket) => {
          const operator = operatorsById.get(ticket.assigned_to)
          const feedback = feedbackMap.get(ticket.id)
          return {
            ...ticket,
            operator_name: operator?.name || null,
            operator_email: operator?.email || null,
            sla_status: getSLAStatus(ticket),
            feedback: feedback ? {
              rating: feedback.rating,
              comment: feedback.comment
            } : null
          }
        })

      res.json({ success: true, data: tickets, count: tickets.length })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  // ===== GET reports =====
  router.get('/reports', async (req, res) => {
    try {
      let query = {}
      if (req.user.role === ROLES.super_admin && req.query.manager_id) query = { manager_id: req.query.manager_id }
      else if (req.user.role === ROLES.manager) query = { manager_id: req.user.id }
      else if (req.user.role === ROLES.operator || req.user.role === ROLES.employee) query = { manager_id: req.user.manager_id }

      const allReports = await store.getReports(query)
      const reports = allReports
        .filter((report) => canAccessTicket(req.user, report.ticket))
        .sort((left, right) => new Date(right.resolved_at) - new Date(left.resolved_at))
      res.json({ success: true, data: reports })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  // ===== GET transfer requests for manager approval =====
  router.get('/transfer-requests', async (req, res) => {
    try {
      if (req.user.role !== ROLES.manager && req.user.role !== ROLES.super_admin) {
        return res.status(403).json({ success: false, error: 'Only admin can view transfer requests' })
      }

      let query = {}
      if (req.user.role === ROLES.super_admin && req.query.manager_id) query.manager_id = req.query.manager_id
      else if (req.user.role === ROLES.manager) query.manager_id = req.user.id
      if (req.query.status) query.status = req.query.status

      const requests = await store.getTransferRequests(query)
      requests.sort((left, right) => new Date(right.requested_at) - new Date(left.requested_at))
      res.json({ success: true, data: requests, count: requests.length })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  // ===== POST operator transfer request =====
  router.post('/:id/transfer-request', async (req, res) => {
    try {
      if (req.user.role !== ROLES.operator) {
        return res.status(403).json({ success: false, error: 'Only agents can request ticket transfer' })
      }

      const ticket = await store.findTicketById(req.params.id)
      if (!ticket || !canAccessTicket(req.user, ticket)) {
        return res.status(404).json({ success: false, error: 'Ticket not found' })
      }
      if (['resolved', 'closed'].includes(ticket.status)) {
        return res.status(400).json({ success: false, error: 'Resolved tickets cannot be transferred' })
      }

      const reason = String(req.body?.reason || '').trim()
      if (!reason) {
        return res.status(400).json({ success: false, error: 'Transfer reason is required' })
      }

      const existing = (await store.getTransferRequests({ ticket_id: ticket.id, status: 'pending' }))[0]
      if (existing) {
        return res.status(400).json({ success: false, error: 'A transfer request is already pending for this ticket' })
      }

      const request = await store.insertTransferRequest({
        id: uuidv4(),
        manager_id: ticket.manager_id,
        ticket_id: ticket.id,
        ticket_title: ticket.title,
        operator_id: req.user.id,
        operator_name: req.user.name,
        operator_email: req.user.email,
        reason,
        status: 'pending',
        requested_at: new Date().toISOString(),
      })

      res.status(201).json({ success: true, data: request, message: 'Transfer request sent to admin for approval' })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  // ===== POST manager approve/reject transfer request =====
  router.post('/transfer-requests/:id/:action', async (req, res) => {
    try {
      if (req.user.role !== ROLES.manager && req.user.role !== ROLES.super_admin) {
        return res.status(403).json({ success: false, error: 'Only admin can review transfer requests' })
      }

      const { id, action } = req.params
      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ success: false, error: 'Choose approve or reject' })
      }

      const request = (await store.getTransferRequests({ id }))[0]
      if (!request) return res.status(404).json({ success: false, error: 'Transfer request not found' })
      if (request.status !== 'pending') return res.status(400).json({ success: false, error: 'Transfer request already reviewed' })
      if (req.user.role === ROLES.manager && request.manager_id !== req.user.id) {
        return res.status(404).json({ success: false, error: 'Transfer request not found' })
      }

      if (action === 'reject') {
        const updated = await store.updateTransferRequest(id, {
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: req.user.id,
          review_note: String(req.body?.note || '').trim(),
        })
        return res.json({ success: true, data: updated, message: 'Transfer request rejected' })
      }

      const ticket = await store.findTicketById(request.ticket_id)
      if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found' })

      if (ticket.assigned_to) {
        const operator = await store.findOperatorById(ticket.assigned_to)
        if (operator) {
          await store.updateOperator(operator.id, {
            current_load: Math.max(0, (operator.current_load || 0) - 1),
            status: operator.status === 'busy' && (operator.current_load || 0) <= 1 ? 'available' : operator.status,
          })
        }
      }

      await store.updateTicket(ticket.id, {
        assigned_to: null,
        status: 'open',
        updated_at: new Date().toISOString(),
      })

      const assignment = await autoAssignTicket(
        store,
        { ...ticket, assigned_to: null, status: 'open' },
        { excludeOperatorIds: [request.operator_id] },
      )
      const updatedRequest = await store.updateTransferRequest(id, {
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: req.user.id,
        review_note: String(req.body?.note || '').trim(),
      })

      await new AuditEvent({
        operator_id: request.operator_id,
        operator_name: request.operator_name || 'Unknown',
        operator_email: request.operator_email || 'Unknown',
        event_type: 'ticket_transferred',
        ticket_id: ticket.id,
        ticket_title: ticket.title,
        details: assignment?.success
          ? `Transfer approved. Reassigned to ${assignment.operator.name}. Reason: ${request.reason}`
          : `Transfer approved. Ticket returned to queue. Reason: ${request.reason}`,
      }).save()

      res.json({
        success: true,
        data: { request: updatedRequest, assignment },
        message: assignment?.success ? `Transfer approved and reassigned to ${assignment.operator.name}` : 'Transfer approved. No matching agent is currently available.',
      })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  // ===== GET single ticket =====
  router.get('/:id', async (req, res) => {
    try {
      const ticket = await store.findTicketById(req.params.id)
      if (!ticket || !canAccessTicket(req.user, ticket)) {
        return res.status(404).json({ success: false, error: 'Ticket not found' })
      }

      const operator = await store.findOperatorById(ticket.assigned_to)
      let logs = []
      
      if (req.user.role === ROLES.manager || req.user.role === ROLES.super_admin) {
        const allLogs = await store.getAssignmentLogs()
        const ticketLogs = allLogs
          .filter((log) => log.ticket_id === req.params.id)
          .sort((left, right) => new Date(right.assigned_at) - new Date(left.assigned_at))
        
        logs = await Promise.all(ticketLogs.map(async (log) => {
          const op = await store.findOperatorById(log.operator_id)
          return {
            ...log,
            operator_name: op?.name || null,
          }
        }))
      }

      // Fetch work log if exists
      const workLog = await WorkLog.findOne({ ticket_id: req.params.id }).lean()

      // Fetch feedback if exists
      const feedback = await Feedback.findOne({ ticket_id: req.params.id }).lean()

      res.json({
        success: true,
        data: {
          ...ticket,
          operator_name: operator?.name || null,
          operator_email: operator?.email || null,
          sla_status: getSLAStatus(ticket),
          assignment_history: logs,
          work_log: workLog || null,
          feedback: feedback || null,
        },
      })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  // ===== POST create ticket =====
  router.post('/', async (req, res) => {
    try {
      if (req.user.role !== ROLES.employee) {
        return res.status(403).json({ success: false, error: 'Only employees can raise new tickets' })
      }

      const { title, description } = req.body
      if (!title || !description) {
        return res.status(400).json({ success: false, error: 'Missing required fields' })
      }
      
      // Smart detection — End User has NO control over these
      const category = detectCategory(title, description)
      const priority = detectPriority(title, description)
      
      const normalizedCategory = normalizeCategory(category)
      const rules = await store.getSlaRules()

      const now = new Date().toISOString()
      const ticket = {
        id: uuidv4(),
        title,
        description,
        priority,
        category: normalizedCategory,
        status: 'open',
        assigned_to: null,
        created_at: now,
        updated_at: now,
        sla_deadline: calculateSLADeadline(priority, rules),
        resolved_at: null,
        reporter_name: req.user.name,
        reporter_email: req.user.email,
        reporter_user_id: req.user.id,
        manager_id: req.user.manager_id,
      }

      await store.insertTicket(ticket)
      const assignmentResult = await autoAssignTicket(store, ticket)
      const finalTicket = await store.findTicketById(ticket.id)
      const operator = await store.findOperatorById(finalTicket.assigned_to)

      res.status(201).json({
        success: true,
        data: {
          ticket: {
            ...finalTicket,
            operator_name: operator?.name || null,
            sla_status: getSLAStatus(finalTicket),
          },
          assignment: assignmentResult,
        },
        message: assignmentResult?.success
          ? `Ticket created and assigned to ${assignmentResult.operator.name}`
          : 'Ticket created. No operators available for auto-assignment.',
      })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  // ===== PUT update ticket =====
  router.put('/:id', async (req, res) => {
    try {
      const ticket = await store.findTicketById(req.params.id)
      if (!ticket) {
        return res.status(404).json({ success: false, error: 'Ticket not found' })
      }

      const now = new Date().toISOString()
      let resolvedAt = ticket.resolved_at

      // ---- Operator updating ticket ----
      if (req.user.role === ROLES.operator) {
        if (!canAccessTicket(req.user, ticket)) {
          return res.status(403).json({ success: false, error: 'This ticket is not assigned to you' })
        }

        const { status, work_log } = req.body
        if (!['in_progress', 'resolved', 'closed'].includes(status)) {
          return res.status(400).json({ success: false, error: 'Operators can mark tickets as in progress, resolved, or closed only' })
        }

        // ===== WORK LOG REQUIREMENT =====
        const isAlreadyResolved = ticket.status === 'resolved' || ticket.status === 'closed'
        if ((status === 'resolved' || status === 'closed') && !isAlreadyResolved) {
          if (!work_log || !work_log.diagnosis || !work_log.resolution || !work_log.service_type) {
            return res.status(400).json({
              success: false,
              error: 'Work log is required to resolve a ticket. Please provide diagnosis, resolution, and service type.',
            })
          }

          if (!VALID_SERVICE_TYPES.includes(work_log.service_type)) {
            return res.status(400).json({
              success: false,
              error: `Invalid service type. Must be one of: ${VALID_SERVICE_TYPES.join(', ')}`,
            })
          }

          // Save work log
          const existingLog = await WorkLog.findOne({ ticket_id: ticket.id })
          if (!existingLog) {
            await new WorkLog({
              ticket_id: ticket.id,
              operator_id: req.user.id,
              operator_name: req.user.name,
              diagnosis: work_log.diagnosis.trim(),
              resolution: work_log.resolution.trim(),
              parts_changed: (work_log.parts_changed || 'N/A').trim(),
              service_type: work_log.service_type,
              time_spent_minutes: parseInt(work_log.time_spent_minutes) || 0,
              notes: (work_log.notes || '').trim(),
            }).save()
          }

          if (!['resolved', 'closed'].includes(ticket.status) && ticket.assigned_to) {
            resolvedAt = now
            await handleResolution(ticket, now)
          }
        }

        const updated = await store.updateTicket(req.params.id, {
          status,
          resolved_at: status === 'resolved' ? resolvedAt : ticket.resolved_at,
          updated_at: now,
        })

        const assignedOperator = await store.findOperatorById(updated.assigned_to)
        return res.json({
          success: true,
          data: {
            ...updated,
            operator_name: assignedOperator?.name || null,
            sla_status: getSLAStatus(updated),
          },
          message: `Ticket marked as ${status.replace('_', ' ')}`,
        })
      }

      // ---- Manager / Super Admin updating ticket ----
      if (req.user.role !== ROLES.manager && req.user.role !== ROLES.super_admin) {
        return res.status(403).json({ success: false, error: 'Only admin can update ticket workflow' })
      }

      const { status, priority } = req.body
      if (priority && !VALID_PRIORITIES.includes(priority)) {
        return res.status(400).json({ success: false, error: 'Choose a valid priority level' })
      }

      if ((status === 'resolved' || status === 'closed') && !['resolved', 'closed'].includes(ticket.status)) {
        resolvedAt = now
        if (ticket.assigned_to) {
          await handleResolution(ticket, now)
        }
      }

      const updated = await store.updateTicket(req.params.id, {
        status: status || ticket.status,
        priority: priority || ticket.priority,
        resolved_at: resolvedAt,
        updated_at: now,
      })

      const operator = await store.findOperatorById(updated.assigned_to)
      res.json({
        success: true,
        data: {
          ...updated,
          operator_name: operator?.name || null,
          sla_status: getSLAStatus(updated),
        },
        message: 'Ticket updated successfully',
      })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  // ===== POST reassign ticket =====
  router.post('/:id/reassign', async (req, res) => {
    try {
      if (req.user.role !== ROLES.manager && req.user.role !== ROLES.super_admin) {
        return res.status(403).json({ success: false, error: 'Only admin can reassign tickets' })
      }

      const ticket = await store.findTicketById(req.params.id)
      if (!ticket) {
        return res.status(404).json({ success: false, error: 'Ticket not found' })
      }

      if (ticket.assigned_to) {
        const operator = await store.findOperatorById(ticket.assigned_to)
        if (operator) {
          await store.updateOperator(operator.id, {
            current_load: Math.max(0, (operator.current_load || 0) - 1),
          })
        }
        await store.updateTicket(ticket.id, {
          assigned_to: null,
          status: 'open',
        })
      }

      const result = await autoAssignTicket(store, { ...ticket, assigned_to: null, status: 'open' })
      res.json({ success: true, data: result, message: result.success ? `Reassigned to ${result.operator.name}` : result.reason })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  // ===== GET assignment logs =====
  router.get('/:id/logs', async (req, res) => {
    try {
      if (req.user.role !== ROLES.manager && req.user.role !== ROLES.super_admin) {
        return res.status(403).json({ success: false, error: 'Only admin can view assignment logs' })
      }

      let query = {}
      if (req.user.role === ROLES.manager) query = { manager_id: req.user.id }
      else if (req.user.role === ROLES.operator || req.user.role === ROLES.employee) query = { manager_id: req.user.manager_id }

      const allLogs = await store.getAssignmentLogs(query)
      const sortedLogs = allLogs
        .filter((log) => log.ticket_id === req.params.id)
        .sort((left, right) => new Date(right.assigned_at) - new Date(left.assigned_at))

      const logs = await Promise.all(sortedLogs.map(async (log) => {
        const operator = await store.findOperatorById(log.operator_id)
        return {
          ...log,
          operator_name: operator?.name || null,
          operator_email: operator?.email || null,
        }
      }))

      res.json({ success: true, data: logs })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  // ===== GET work log =====
  router.get('/:id/worklog', async (req, res) => {
    try {
      const ticket = await store.findTicketById(req.params.id)
      if (!ticket || !canAccessTicket(req.user, ticket)) {
        return res.status(404).json({ success: false, error: 'Ticket not found' })
      }

      const workLog = await WorkLog.findOne({ ticket_id: req.params.id }).lean()
      res.json({ success: true, data: workLog || null })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  // ===== POST feedback =====
  router.post('/:id/feedback', async (req, res) => {
    try {
      const ticket = await store.findTicketById(req.params.id)
      if (!ticket) {
        return res.status(404).json({ success: false, error: 'Ticket not found' })
      }

      // Only the end user who raised the ticket can give feedback
      if (req.user.role !== ROLES.employee) {
        return res.status(403).json({ success: false, error: 'Only the end user can submit feedback' })
      }
      if (ticket.reporter_user_id !== req.user.id) {
        return res.status(403).json({ success: false, error: 'You can only give feedback on your own tickets' })
      }

      // Only after resolution
      if (!['resolved', 'closed'].includes(ticket.status)) {
        return res.status(400).json({ success: false, error: 'Feedback can only be submitted for resolved tickets' })
      }

      // Prevent duplicate feedback
      const existing = await Feedback.findOne({ ticket_id: req.params.id })
      if (existing) {
        return res.status(400).json({ success: false, error: 'Feedback already submitted for this ticket' })
      }

      const { rating, comment } = req.body
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ success: false, error: 'Rating must be between 1 and 5' })
      }

      const feedback = new Feedback({
        ticket_id: req.params.id,
        operator_id: ticket.assigned_to || 'unassigned',
        employee_id: req.user.id,
        rating: parseInt(rating),
        comment: (comment || '').trim(),
      })
      await feedback.save()
      
      // Create audit event for visibility
      const operator = await store.findOperatorById(ticket.assigned_to)
      await new AuditEvent({
        operator_id: ticket.assigned_to || 'unassigned',
        operator_name: operator?.name || 'Unknown',
        operator_email: operator?.email || 'Unknown',
        event_type: 'feedback_submitted',
        ticket_id: ticket.id,
        ticket_title: ticket.title,
        details: `Rating: ${rating}/5 - ${comment.substring(0, 50)}${comment.length > 50 ? '...' : ''}`,
        csat_score: parseInt(rating),
      }).save()

      res.json({ success: true, data: feedback.toObject(), message: 'Thank you for your feedback!' })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  // ===== GET feedback =====
  router.get('/:id/feedback', async (req, res) => {
    try {
      const ticket = await store.findTicketById(req.params.id)
      if (!ticket || !canAccessTicket(req.user, ticket)) {
        return res.status(404).json({ success: false, error: 'Ticket not found' })
      }

      const feedback = await Feedback.findOne({ ticket_id: req.params.id }).lean()
      res.json({ success: true, data: feedback || null })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  return router
}
