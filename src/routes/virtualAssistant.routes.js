const express = require('express');
const router = express.Router();
const virtualAssistantController = require('../controllers/virtualAssistant.controller');

// Public chat endpoint (tanpa auth token, untuk pengunjung website umum)
router.post('/chat', virtualAssistantController.chatWithAssistant);

module.exports = router;
