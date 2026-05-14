const express = require('express')
const { v4: uuidv4 } = require('uuid')
const { ROLES, requireAuth, requireRole, sanitizeUser, hashPassword } = require('../auth.cjs')
const { createFirebaseAuthUser, deleteFirebaseAuthUser } = require('../firebase.cjs')

module.exports = (store) => {
  const router = express.Router()

  // All routes require Super Admin
  router.use(requireAuth)
  router.use(requireRole(ROLES.super_admin))

  /**
   * GET /api/superadmin/overview — system-wide stats
   */
  router.get('/overview', async (req, res) => {
    try {
      const [managers, operators, employees, tickets] = await Promise.all([
        store.getManagers(),
        store.getOperators(),
        store.getEmployees(),
        store.getTickets(),
      ])

      const openTickets = tickets.filter(t => ['open', 'in_progress'].includes(t.status))
      const resolvedTickets = tickets.filter(t => ['resolved', 'closed'].includes(t.status))
      const onlineAgents = operators.filter(o => o.status === 'available')

      res.json({
        success: true,
        data: {
          total_managers: managers.length,
          total_operators: operators.length,
          total_employees: employees.length,
          total_tickets: tickets.length,
          open_tickets: openTickets.length,
          resolved_tickets: resolvedTickets.length,
          online_agents: onlineAgents.length,
          system_health: onlineAgents.length > 0 ? 'operational' : 'degraded',
        },
      })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  /**
   * GET /api/superadmin/managers — list all managers
   */
  router.get('/managers', async (req, res) => {
    try {
      const [managers, tickets, operators, employees] = await Promise.all([
        store.getManagers(),
        store.getTickets(),
        store.getOperators(),
        store.getEmployees(),
      ])

      const countByManager = (items) => items.reduce((counts, item) => {
        if (!item.manager_id) return counts
        counts[item.manager_id] = (counts[item.manager_id] || 0) + 1
        return counts
      }, {})

      const ticketCounts = countByManager(tickets)
      const operatorCounts = countByManager(operators)
      const employeeCounts = countByManager(employees)

      const safeManagers = managers.map(m => {
        const { password_hash, ...safe } = m
        return {
          ...safe,
          ticket_count: ticketCounts[m.id] || 0,
          operator_count: operatorCounts[m.id] || 0,
          employee_count: employeeCounts[m.id] || 0,
        }
      })

      res.json({ success: true, data: safeManagers, count: safeManagers.length })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  /**
   * POST /api/superadmin/managers — create a new manager account
   */
  router.post('/managers', async (req, res) => {
    try {
      const { name, email, password } = req.body
      if (!name || !email) {
        return res.status(400).json({ success: false, error: 'Name and email are required' })
      }

      // Check if email already exists
      const existingManager = await store.findManagerByEmail(email)
      if (existingManager) {
        return res.status(400).json({ success: false, error: 'A manager with this email already exists' })
      }

      // Check across all roles
      const existingSA = await store.findSuperAdminByEmail(email)
      const existingOp = await store.findOperatorByEmail(email)
      const existingEmp = await store.findEmployeeByEmail(email)
      if (existingSA || existingOp || existingEmp) {
        return res.status(400).json({ success: false, error: 'This email is already registered in another role' })
      }

      // Try to create a Firebase Auth account for them
      let firebaseUid = null
      const resolvedPassword = password || `Admin@${Date.now().toString(36)}`
      try {
        const fbUser = await createFirebaseAuthUser(email, resolvedPassword, name)
        firebaseUid = fbUser.uid
      } catch (fbErr) {
        console.warn('[SuperAdmin] Could not create Firebase user:', fbErr.message)
      }

      const manager = {
        id: uuidv4(),
        name,
        email: email.toLowerCase(),
        password_hash: hashPassword(resolvedPassword),
        last_set_password: resolvedPassword,
        role: ROLES.manager,
        firebase_uid: firebaseUid,
        provider: 'firebase',
        created_at: new Date().toISOString(),
      }

      await store.insertManager(manager)
      const { password_hash, ...safeManager } = manager

      res.status(201).json({
        success: true,
        data: {
          manager: safeManager,
          credentials: { email: manager.email, password: resolvedPassword },
        },
        message: `Admin ${name} created successfully`,
      })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  /**
   * DELETE /api/superadmin/managers/:id — remove a manager
   */
  router.delete('/managers/:id', async (req, res) => {
    try {
      const manager = await store.findManagerById(req.params.id)
      if (!manager) {
        return res.status(404).json({ success: false, error: 'Manager not found' })
      }

      // Delete from Firebase Auth if they have a uid
      if (manager.firebase_uid) {
        await deleteFirebaseAuthUser(manager.firebase_uid)
      }

      await store.deleteManager(manager.id)

      res.json({
        success: true,
        message: `Manager ${manager.name} removed successfully`,
      })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  /**
   * POST /api/superadmin/managers/:id/reset-password — reset manager password
   */
  router.post('/managers/:id/reset-password', async (req, res) => {
    try {
      const manager = await store.findManagerById(req.params.id)
      if (!manager) {
        return res.status(404).json({ success: false, error: 'Manager not found' })
      }

      const newPassword = req.body.password || `Admin@${Date.now().toString(36)}`
      if (newPassword.length < 8) {
        return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' })
      }

      if (manager.firebase_uid) {
        const admin = require('firebase-admin')
        await admin.auth().updateUser(manager.firebase_uid, { password: newPassword }).catch(err => {
          console.warn('[SuperAdmin] Failed to update Firebase password on reset:', err.message)
        })
      }

      await store.updateManager(manager.id, {
        password_hash: hashPassword(newPassword),
        last_set_password: newPassword,
      })

      res.json({
        success: true,
        data: { credentials: { email: manager.email, password: newPassword } },
        message: `Password reset for ${manager.name}`,
      })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  return router
}
