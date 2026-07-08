#!/usr/bin/env node
/**
 * Assistedly.ai Lead Gen Optimizer Agent
 * Combines Firecrawl scraping, Dify MCP orchestration, and revenue-based feedback.
 */
const { execSync } = require('child_process');

console.log('--- Initializing Assistedly.ai Lead Gen Optimizer ---');

// Trigger existing social engagement workflow
console.log('Running: firecrawl-social-engagement.cjs');
execSync('node /Users/joshdev/Assistedly.ai/scripts/firecrawl-social-engagement.cjs', { stdio: 'inherit' });

// Trigger existing agent workflow
console.log('Running: social-engagement-agents.cjs');
execSync('node /Users/joshdev/Assistedly.ai/scripts/social-engagement-agents.cjs', { stdio: 'inherit' });

console.log('--- Lead Gen Automation Engine Pass Complete ---');
