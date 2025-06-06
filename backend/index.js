const { initializeDB } = require("./db/db.connect");
require("dotenv").config();
const Lead = require("./models/leads.models");
const SalesAgent = require("./models/salesAgent.models");
const Comment = require("./models/comments.models");
const User = require("./models/user.models");
initializeDB();
const express = require("express");
const bcrypt = require("bcryptjs");
const verifyToken = require("./middleware/verifyToken.js");
const jwt = require("jsonwebtoken");
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid password" });

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: "24h",
    });
    // Remove sensitive fields like password before sending
    const { password: _, ...userWithoutPassword } = user.toObject();

    res.json({ token, user: userWithoutPassword });
  } catch (error) {
    res.status(500).json({ message: "Login failed", error });
  }
});

app.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existinguser = await User.findOne({ email });
    if (existinguser) {
      return res.status(400).json({ message: "User already exist" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword });
    await user.save();
    res.status(200).json({ message: "user registered successfully" });
  } catch (error) {
    res.status(500).json({ message: "Signup failed", error });
  }
});

app.get("/leads", verifyToken, async (req, res) => {
  const allowedStatuses = [
    "New",
    "Contacted",
    "Qualified",
    "Proposal Sent",
    "Closed",
  ];
  const allowedSources = [
    "Website",
    "Referral",
    "Social Media",
    "Advertisement",
    "Cold Call",
    "Email",
  ];

  try {
    const { salesAgent, status, tags, source } = req.query;
    let filter = {};

    if (salesAgent && !mongoose.Types.ObjectId.isValid(salesAgent)) {
      return res
        .status(400)
        .json({
          error: "Invalid input: 'salesAgent' must be a valid ObjectId.",
        });
    }
    if (salesAgent) filter.salesAgent = salesAgent;

    // Validate status
    if (status && !allowedStatuses.includes(status)) {
      return res
        .status(400)
        .json({
          error: `Invalid input: 'status' must be one of ${JSON.stringify(
            allowedStatuses
          )}.`,
        });
    }
    if (status) filter.status = status;

    // Validate source
    if (source && !allowedSources.includes(source)) {
      return res
        .status(400)
        .json({
          error: `Invalid input: 'source' must be one of ${JSON.stringify(
            allowedSources
          )}.`,
        });
    }
    if (source) filter.source = source;

    // Handle tags as an array if provided
    if (tags) filter.tags = { $in: tags.split(",") };

    const getAllLeads = await Lead.find(filter).populate("salesAgent", "name");
    res.status(200).json(getAllLeads);
  } catch (error) {
    res.status(500).json({ error: "Internal server error." });
  }
});

app.get("/agents", verifyToken, async (req, res) => {
  try {
    const getAllAgents = await SalesAgent.find();
    res.status(200).json(getAllAgents);
  } catch (error) {
    res.status(500).json({ error: "Internal server error.", error });
  }
});

app.post("/leads", verifyToken, async (req, res) => {
  try {
    const { name, source, salesAgent, status, tags, timeToClose, priority } =
      req.body;
    if (!name) {
      res.status(400).json({ error: "Invalid input: 'name' is required." });
    }
    const newLeads = new Lead({
      name,
      source,
      salesAgent,
      status,
      tags,
      timeToClose,
      priority,
    });
    await newLeads.save();

    // Populate the salesAgent field before sending response
    await newLeads.populate("salesAgent", "name");

    if (!newLeads) {
      res
        .status(404)
        .json({ error: `Sales agent with ID ${salesAgent._id} not found.` });
    }
    res
      .status(201)
      .json({ message: "New Lead created successfully", lead: newLeads });
  } catch (error) {
    res.status(500).json({ error: "Internal server error." });
  }
});

app.put("/leads/:id", verifyToken, async (req, res) => {
  try {
    const leadId = req.params.id;
    const dataToUpdate = req.body;

    if (!mongoose.Types.ObjectId.isValid(leadId)) {
      return res.status(400).json({ error: "Invalid Lead Id" });
    }

    // Allowed status and source values
    const validStatuses = [
      "New",
      "Contacted",
      "Qualified",
      "Proposal Sent",
      "Closed",
    ];
    const validSources = [
      "Website",
      "Referral",
      "Cold Call",
      "Advertisement",
      "Email",
      "Other",
    ];

    // Validate status
    if (dataToUpdate.status && !validStatuses.includes(dataToUpdate.status)) {
      return res
        .status(400)
        .json({
          error: `Invalid input: 'status' must be one of ${JSON.stringify(
            validStatuses
          )}.`,
        });
    }

    // Validate source
    if (dataToUpdate.source && !validSources.includes(dataToUpdate.source)) {
      return res
        .status(400)
        .json({
          error: `Invalid input: 'source' must be one of ${JSON.stringify(
            validSources
          )}.`,
        });
    }

    // ✅ Ensure closedAt is set if the status is changed to "Closed"
    if (dataToUpdate.status === "Closed" && !dataToUpdate.closedAt) {
      dataToUpdate.closedAt = new Date();
    }

    const updatedLead = await Lead.findByIdAndUpdate(leadId, dataToUpdate, {
      new: true,
    });

    if (!updatedLead) {
      return res
        .status(404)
        .json({ error: `Lead with id ${leadId} not found` });
    }

    res.status(200).json(updatedLead);
  } catch (error) {
    console.error("Error updating lead:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

app.delete("/leads/:id", verifyToken, async (req, res) => {
  try {
    const leadId = req.params.id;
    const deletedLead = await Lead.findByIdAndDelete(leadId);
    if (!deletedLead) {
      res.status(404).json({ error: `Lead with ID ${leadId} not found.` });
    } else {
      res.status(200).json({ message: "Lead deleted successfully." });
    }
  } catch (error) {
    res.status(500).json({ error: "Internal server error." });
  }
});

app.post("/agents", verifyToken, async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || typeof name !== "string") {
      return res
        .status(400)
        .json({ error: "Invalid input, name must be a string." });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return res
        .status(400)
        .json({
          error: "Invalid input: 'email' must be a valid email address.",
        });
    }

    const existingAgent = await SalesAgent.findOne({ email });
    if (existingAgent) {
      return res
        .status(409)
        .json({ error: `Sales agent with email ${email} already exist` });
    }

    const newAgents = new SalesAgent({ name, email });
    await newAgents.save();

    const formattedResponse = {
      id: newAgents._id,
      name: newAgents.name,
      email: newAgents.email,
    };
    res.status(201).json(formattedResponse);
  } catch (error) {
    res.status(500).json({ error: "Internal server error." });
  }
});

app.get("/leads/:id/comments", verifyToken, async (req, res) => {
  try {
    const leadId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(leadId)) {
      res.status(404).json({ error: `Lead with ID ${leadId} not found.` });
    }
    const getAllComments = await Comment.find({ lead: leadId }).populate(
      "author",
      "name"
    );

    const formattedComments = getAllComments.map((comment) => ({
      id: comment._id.toString(),
      commentText: comment.commentText,
      author: comment.author.name,
      createdAt: comment.createdAt.toISOString(),
    }));

    return res.status(200).json(formattedComments);
  } catch (error) {
    res.status(500).json({ error: "Internal server error." });
  }
});

app.post("/leads/:id/comments", verifyToken, async (req, res) => {
  try {
    const leadId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(leadId)) {
      res.status(404).json({ error: `Lead with ID ${leadId} not found.` });
    }

    const { author, commentText } = req.body;
    if (!commentText || typeof commentText !== "string") {
      res.status(400).json({ error: "comment text must be string." });
    }

    const addNewComment = new Comment({ lead: leadId, author, commentText });
    await addNewComment.save();
    await addNewComment.populate("author", "name");

    // Format response
    const formattedResponse = {
      id: addNewComment._id,
      commentText: addNewComment.commentText,
      author: addNewComment.author.name,
      createdAt: addNewComment.createdAt,
    };

    res.status(201).json(formattedResponse);
  } catch (error) {
    res.status(500).json({ error: "Internal server error." });
  }
});

app.get("/report/last-week", verifyToken, async (req, res) => {
  try {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);

    const closedLeads = await Lead.find({
      status: "Closed",
      closedAt: { $gte: lastWeek },
    }).populate("salesAgent", "name");

    const response = closedLeads.map((lead) => ({
      id: lead._id,
      name: lead.name,
      salesAgent: lead.salesAgent.name,
      closedAt: lead.closedAt,
    }));

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ error: "Internal server error." });
  }
});

app.get("/report/pipeline", verifyToken, async (re, res) => {
  try {
    const totalLeadsInPipeline = await Lead.countDocuments({
      status: { $ne: "Closed" },
    });
    res.status(200).json({ totalLeadsInPipeline });
  } catch (error) {
    res.status(500).json({ error: "Internal server error." });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});