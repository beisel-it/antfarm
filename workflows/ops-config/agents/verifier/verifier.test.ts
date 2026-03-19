import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const VERIFIER_DIR = __dirname;
const AGENTS_MD = join(VERIFIER_DIR, 'AGENTS.md');
const SOUL_MD = join(VERIFIER_DIR, 'SOUL.md');
const IDENTITY_MD = join(VERIFIER_DIR, 'IDENTITY.md');

describe('Verifier Agent Configuration', () => {
  it('AGENTS.md exists', () => {
    assert.ok(existsSync(AGENTS_MD), 'AGENTS.md should exist');
    assert.ok(statSync(AGENTS_MD).isFile(), 'AGENTS.md should be a file');
  });

  it('SOUL.md exists', () => {
    assert.ok(existsSync(SOUL_MD), 'SOUL.md should exist');
    assert.ok(statSync(SOUL_MD).isFile(), 'SOUL.md should be a file');
  });

  it('IDENTITY.md exists', () => {
    assert.ok(existsSync(IDENTITY_MD), 'IDENTITY.md should exist');
    assert.ok(statSync(IDENTITY_MD).isFile(), 'IDENTITY.md should be a file');
  });

  it('AGENTS.md includes ops-specific verification steps', () => {
    const content = readFileSync(AGENTS_MD, 'utf-8');
    
    // Check for configuration validation
    assert.ok(
      content.includes('nginx -t') || content.includes('Configuration Validation'),
      'AGENTS.md should include configuration validation steps'
    );
    
    // Check for service status verification
    assert.ok(
      content.includes('systemctl') && content.includes('is-active'),
      'AGENTS.md should include service status checks'
    );
    
    // Check for functional/connectivity testing
    assert.ok(
      content.includes('curl') || content.includes('connectivity') || content.includes('Functional'),
      'AGENTS.md should include connectivity/functional tests'
    );
    
    // Check for log verification
    assert.ok(
      content.includes('journalctl') || content.includes('logs'),
      'AGENTS.md should include log checking procedures'
    );
  });

  it('AGENTS.md verifies config file changes', () => {
    const content = readFileSync(AGENTS_MD, 'utf-8');
    
    assert.ok(
      content.includes('Verify File Changes') || 
      content.includes('diff') || 
      content.includes('git diff'),
      'AGENTS.md should include file change verification'
    );
    
    assert.ok(
      content.includes('actual') && content.includes('claimed'),
      'AGENTS.md should emphasize verifying actual vs claimed changes'
    );
  });

  it('AGENTS.md includes service status verification', () => {
    const content = readFileSync(AGENTS_MD, 'utf-8');
    
    // Check for service status commands
    assert.ok(
      content.includes('systemctl status') || content.includes('systemctl is-active'),
      'AGENTS.md should include systemctl status checks'
    );
    
    // Check for service health verification
    assert.ok(
      content.includes('Service Status') || content.includes('service') && content.includes('health'),
      'AGENTS.md should have a service status verification section'
    );
  });

  it('AGENTS.md includes connectivity testing procedures', () => {
    const content = readFileSync(AGENTS_MD, 'utf-8');
    
    // Check for connectivity test examples
    assert.ok(
      content.includes('curl') || content.includes('nc -zv') || content.includes('connectivity'),
      'AGENTS.md should include connectivity test examples'
    );
    
    // Check for functional testing section
    assert.ok(
      content.includes('Functional') || content.includes('functionality'),
      'AGENTS.md should have functional testing guidance'
    );
  });

  it('AGENTS.md verifies backups were created', () => {
    const content = readFileSync(AGENTS_MD, 'utf-8');
    
    assert.ok(
      content.includes('Backup Verification') || content.includes('verify') && content.includes('backup'),
      'AGENTS.md should include backup verification steps'
    );
    
    assert.ok(
      content.includes('ls -lh') || content.includes('stat') || content.includes('backup file exists'),
      'AGENTS.md should include commands to check backup existence'
    );
  });

  it('AGENTS.md validates rollback plans', () => {
    const content = readFileSync(AGENTS_MD, 'utf-8');
    
    assert.ok(
      content.includes('Rollback Plan') || content.includes('rollback') && content.includes('valid'),
      'AGENTS.md should include rollback plan validation'
    );
    
    assert.ok(
      content.includes('Good rollback') || content.includes('rollback command'),
      'AGENTS.md should provide rollback plan examples or criteria'
    );
  });

  it('IDENTITY.md defines verifier role correctly', () => {
    const content = readFileSync(IDENTITY_MD, 'utf-8');
    
    assert.ok(
      content.toLowerCase().includes('verifier'),
      'IDENTITY.md should reference verifier role'
    );
    
    assert.ok(
      content.toLowerCase().includes('role'),
      'IDENTITY.md should define the agent role'
    );
    
    assert.ok(
      content.toLowerCase().includes('quality') || content.toLowerCase().includes('verif'),
      'IDENTITY.md should mention verification or quality checking'
    );
  });

  it('SOUL.md describes skeptical, evidence-based persona', () => {
    const content = readFileSync(SOUL_MD, 'utf-8');
    
    // Check for skeptical/critical mindset
    assert.ok(
      content.toLowerCase().includes('skeptical') || 
      content.toLowerCase().includes('evidence') ||
      content.toLowerCase().includes('trust'),
      'SOUL.md should emphasize skeptical, evidence-based approach'
    );
    
    // Check for thoroughness
    assert.ok(
      content.toLowerCase().includes('thorough') || content.toLowerCase().includes('specific'),
      'SOUL.md should emphasize thoroughness'
    );
    
    // Check for actionable feedback emphasis
    assert.ok(
      content.toLowerCase().includes('actionable') || content.toLowerCase().includes('specific'),
      'SOUL.md should emphasize providing actionable feedback'
    );
  });

  it('AGENTS.md defines verifier as verification role (read + exec, NO write)', () => {
    const content = readFileSync(AGENTS_MD, 'utf-8');
    
    // Check for mention of read + exec permissions
    assert.ok(
      content.includes('read + exec') || 
      content.includes('verification role'),
      'AGENTS.md should specify verifier has read + exec access'
    );
    
    // Check for explicit "no write" restriction
    assert.ok(
      content.includes('NO write') || content.includes('cannot modify'),
      'AGENTS.md should explicitly state verifier cannot modify files'
    );
  });

  it('AGENTS.md defines clear approval and rejection criteria', () => {
    const content = readFileSync(AGENTS_MD, 'utf-8');
    
    // Check for approval criteria
    assert.ok(
      content.includes('Approve') || content.includes('STATUS: done'),
      'AGENTS.md should define approval criteria'
    );
    
    // Check for rejection criteria
    assert.ok(
      content.includes('Reject') || content.includes('STATUS: retry'),
      'AGENTS.md should define rejection criteria'
    );
    
    // Check for decision-making section
    assert.ok(
      content.includes('Decision Criteria') || content.includes('If everything checks out'),
      'AGENTS.md should have a decision criteria section'
    );
  });

  it('AGENTS.md emphasizes evidence-based verification', () => {
    const content = readFileSync(AGENTS_MD, 'utf-8');
    
    assert.ok(
      content.includes('evidence') || content.includes('Evidence'),
      'AGENTS.md should emphasize evidence-based verification'
    );
    
    assert.ok(
      content.toLowerCase().includes('check') || content.toLowerCase().includes('verify'),
      'AGENTS.md should emphasize checking and verifying'
    );
  });

  it('AGENTS.md references shared verifier files appropriately', () => {
    const content = readFileSync(AGENTS_MD, 'utf-8');
    
    // Check for reference to shared files
    assert.ok(
      content.includes('agents/shared/verifier') || 
      content.includes('SOUL.md') || 
      content.includes('IDENTITY.md') ||
      content.includes('shared verifier'),
      'AGENTS.md should reference shared verifier files or inheritance'
    );
  });

  it('all markdown files have reasonable content length', () => {
    const agentsContent = readFileSync(AGENTS_MD, 'utf-8');
    const soulContent = readFileSync(SOUL_MD, 'utf-8');
    const identityContent = readFileSync(IDENTITY_MD, 'utf-8');
    
    assert.ok(
      agentsContent.length > 1000,
      `AGENTS.md should have substantial content (found ${agentsContent.length} chars, expected > 1000)`
    );
    
    assert.ok(
      soulContent.length > 200,
      `SOUL.md should have meaningful content (found ${soulContent.length} chars, expected > 200)`
    );
    
    assert.ok(
      identityContent.length > 20,
      `IDENTITY.md should have basic content (found ${identityContent.length} chars, expected > 20)`
    );
  });
});
