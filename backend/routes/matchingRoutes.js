const express = require("express");

const {
  getSmartMatches,
} = require("../controllers/matchingController");

const router = express.Router();

router.get("/", getSmartMatches);

module.exports = router;