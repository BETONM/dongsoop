const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');

router.get('/', (req, res) => {
    res.json({ success: true, message: "mission api 성공" });
});

module.exports = router;