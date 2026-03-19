import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const IMPLEMENTER_DIR = __dirname;
const AGENTS_MD = join(IMPLEMENTER_DIR, 'AGENTS.md');
const SOUL_MD = join(IMPLEMENTER_DIR, 'SOUL.md');
const IDENTITY_MD = join(IMPLEMENTER_DIR, 'IDENTITY.md');

describe('Implementer Agent Configuration', () => {
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

  it('AGENTS.md mandates backup creation before changes', () => {
    const content = readFileSync(AGENTS_MD, 'utf-8');
    
    // Check for backup-related mandatory language
    assert.ok(
      content.includes('MANDATORY') || content.includes('NEVER modify configuration without backing up'),
      'AGENTS.md should mandate backups with strong language'
    );
    
    // Check for backup strategy section
    assert.ok(
      content.includes('Backup Strategy') || content.includes('## Backup'),
      'AGENTS.md should have a backup strategy section'
    );
    
    // Check for specific backup instructions
    assert.ok(
      content.includes('RULE') && content.includes('backup'),
      'AGENTS.md should have explicit backup rules'
    );
    
    // Check for "backup before" language
    assert.ok(
      content.toLowerCase().includes('backup') && content.toLowerCase().includes('before'),
      'AGENTS.md should emphasize backing up BEFORE changes'
    );
  });

  it('AGENTS.md includes rollback procedures', () => {
    const content = readFileSync(AGENTS_MD, 'utf-8');
    
    // Check for rollback section
    assert.ok(
      content.includes('Rollback') || content.includes('rollback'),
      'AGENTS.md should include rollback information'
    );
    
    // Check for rollback plan documentation requirements
    assert.ok(
      content.includes('ROLLBACK') || content.includes('rollback plan'),
      'AGENTS.md should require documenting rollback plans'
    );
    
    // Check for rollback examples or procedures
    const rollbackMentions = (content.match(/rollback/gi) || []).length;
    assert.ok(
      rollbackMentions >= 5,
      `AGENTS.md should mention rollback multiple times (found ${rollbackMentions}, expected >= 5)`
    );
    
    // Check for specific rollback command examples
    assert.ok(
      content.includes('ROLLBACK:') && content.includes('sudo cp'),
      'AGENTS.md should include concrete rollback command examples'
    );
  });

  it('IDENTITY.md defines implementer role correctly', () => {
    const content = readFileSync(IDENTITY_MD, 'utf-8');
    
    assert.ok(
      content.toLowerCase().includes('implementer'),
      'IDENTITY.md should reference implementer role'
    );
    
    assert.ok(
      content.toLowerCase().includes('role'),
      'IDENTITY.md should define the agent role'
    );
  });

  it('SOUL.md describes precise, careful, rollback-conscious persona', () => {
    const content = readFileSync(SOUL_MD, 'utf-8');
    
    // Check for precision/carefulness
    assert.ok(
      content.toLowerCase().includes('precise') || 
      content.toLowerCase().includes('careful') || 
      content.toLowerCase().includes('methodical'),
      'SOUL.md should emphasize precision and carefulness'
    );
    
    // Check for rollback consciousness
    assert.ok(
      content.toLowerCase().includes('rollback'),
      'SOUL.md should emphasize rollback consciousness'
    );
    
    // Check for backup awareness
    assert.ok(
      content.toLowerCase().includes('backup'),
      'SOUL.md should emphasize backup awareness'
    );
    
    // Check for safety/caution themes
    const safetyKeywords = ['safe', 'verify', 'validate', 'check', 'discipline'];
    const hasSafetyThemes = safetyKeywords.some(keyword => 
      content.toLowerCase().includes(keyword)
    );
    assert.ok(
      hasSafetyThemes,
      'SOUL.md should emphasize safety and verification'
    );
  });

  it('AGENTS.md defines implementer as coding role (full read/write/exec)', () => {
    const content = readFileSync(AGENTS_MD, 'utf-8');
    
    // Check for mention of permissions/access level
    assert.ok(
      content.includes('read/write/execute') || 
      content.includes('full') && content.includes('permissions') ||
      content.includes('coding role'),
      'AGENTS.md should specify implementer has full read/write/exec access'
    );
  });

  it('AGENTS.md emphasizes one step per session pattern', () => {
    const content = readFileSync(AGENTS_MD, 'utf-8');
    
    assert.ok(
      content.includes('ONE step') || content.includes('one step'),
      'AGENTS.md should emphasize one step per session'
    );
    
    assert.ok(
      content.includes('session') || content.includes('fresh session'),
      'AGENTS.md should mention session isolation'
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
      soulContent.length > 500,
      `SOUL.md should have meaningful content (found ${soulContent.length} chars, expected > 500)`
    );
    
    assert.ok(
      identityContent.length > 20,
      `IDENTITY.md should have basic content (found ${identityContent.length} chars, expected > 20)`
    );
  });
});
