const express = require('express')
const { RoutingConfig } = require('../models/RoutingConfig.cjs')
const { SlaRule } = require('../models.cjs')
const { requireRole, ROLES } = require('../auth.cjs')

module.exports = function (db) {
  const router = express.Router()

  // Managers and Super Admins can access settings
  router.use(requireRole(ROLES.manager, ROLES.super_admin))

  // Ensure default routing config exists
  ;(async () => {
    try {
      const existing = await RoutingConfig.findOne({ id: 'default' })
      if (!existing) {
        await new RoutingConfig({ id: 'default' }).save()
        console.log('Created default routing config.')
      }
    } catch (err) {
      console.error('Failed to seed routing config:', err.message)
    }
  })()

  // GET /api/settings/routing
  router.get('/routing', async (req, res) => {
    try {
      let config = await RoutingConfig.findOne({ id: 'default' }).lean()
      if (!config) {
        config = await new RoutingConfig({ id: 'default' }).save()
        config = config.toObject()
      }
      res.json({ success: true, data: config })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  // PUT /api/settings/routing
  router.put('/routing', async (req, res) => {
    try {
      const { max_load_global, priority_weights, skill_routing_enabled, load_balancing_enabled, priority_boost_enabled } = req.body
      const updates = { updated_at: new Date() }
      if (max_load_global !== undefined) updates.max_load_global = Math.max(1, Math.min(20, Number(max_load_global)))
      if (priority_weights) updates.priority_weights = priority_weights
      if (skill_routing_enabled !== undefined) updates.skill_routing_enabled = Boolean(skill_routing_enabled)
      if (load_balancing_enabled !== undefined) updates.load_balancing_enabled = Boolean(load_balancing_enabled)
      if (priority_boost_enabled !== undefined) updates.priority_boost_enabled = Boolean(priority_boost_enabled)

      const config = await RoutingConfig.findOneAndUpdate({ id: 'default' }, updates, { new: true, upsert: true }).lean()
      res.json({ success: true, data: config, message: 'Routing configuration updated.' })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  // GET /api/settings/sla
  router.get('/sla', async (req, res) => {
    try {
      const rules = await SlaRule.find().lean()
      res.json({ success: true, data: rules })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  // PUT /api/settings/sla
  router.put('/sla', async (req, res) => {
    try {
      const { rules } = req.body
      if (!Array.isArray(rules)) {
        return res.status(400).json({ success: false, error: 'Rules must be an array' })
      }
      for (const rule of rules) {
        await SlaRule.findOneAndUpdate(
          { priority: rule.priority },
          { hours_limit: rule.hours_limit, description: rule.description || '' },
          { upsert: true },
        )
      }
      const updated = await SlaRule.find().lean()
      res.json({ success: true, data: updated, message: 'SLA rules updated.' })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  return router
}
