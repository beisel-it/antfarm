import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const inspectorDir = join(process.cwd(), 'workflows/ops-config/agents/inspector');

describe('Inspector Agent', () => {
  it('inspector directory exists', () => {
    assert.ok(existsSync(inspectorDir), 'inspector directory should exist');
    assert.ok(statSync(inspectorDir).isDirectory(), 'inspector should be a directory');
  });

  it('AGENTS.md exists and defines inspection process', () => {
    const agentsPath = join(inspectorDir, 'AGENTS.md');
    assert.ok(existsSync(agentsPath), 'AGENTS.md should exist');
    
    const content = readFileSync(agentsPath, 'utf-8');
    
    // Key sections that should be present
    assert.ok(content.includes('# Inspector Agent'), 'should have Inspector Agent title');
    assert.ok(content.includes('## Your Role'), 'should define the agent role');
    assert.ok(content.includes('## Your Process'), 'should define the inspection process');
    assert.ok(content.includes('## What to Inspect'), 'should list what to inspect');
    assert.ok(content.includes('## Risk Identification'), 'should define risk identification');
    assert.ok(content.includes('## Backup Needs Assessment'), 'should define backup assessment');
    assert.ok(content.includes('## Output Format'), 'should define output format');
    
    // Should emphasize read-only nature
    assert.ok(content.includes('read-only') || content.includes('READ-ONLY'), 'should emphasize read-only nature');
  });

  it('AGENTS.md includes required output format with CURRENT_STATE, RISKS, BACKUP_NEEDED', () => {
    const agentsPath = join(inspectorDir, 'AGENTS.md');
    const content = readFileSync(agentsPath, 'utf-8');
    
    // Must define these three output fields
    assert.ok(content.includes('CURRENT_STATE:'), 'should define CURRENT_STATE output');
    assert.ok(content.includes('RISKS:'), 'should define RISKS output');
    assert.ok(content.includes('BACKUP_NEEDED:'), 'should define BACKUP_NEEDED output');
    
    // Should explain what each field contains
    assert.ok(
      content.toLowerCase().includes('current state') && content.includes('summary'),
      'should explain CURRENT_STATE contains system summary'
    );
    assert.ok(
      content.includes('HIGH') || content.includes('MEDIUM') || content.includes('LOW'),
      'should define risk severity levels'
    );
    assert.ok(
      content.includes('backup') && (content.includes('files') || content.includes('directories')),
      'should explain what needs backup'
    );
  });

  it('AGENTS.md defines inspection commands and tools', () => {
    const agentsPath = join(inspectorDir, 'AGENTS.md');
    const content = readFileSync(agentsPath, 'utf-8');
    
    // Should include examples of inspection commands
    assert.ok(content.includes('systemctl'), 'should mention systemctl for service inspection');
    assert.ok(content.includes('ps') || content.includes('top'), 'should mention process inspection');
    assert.ok(content.includes('df') || content.includes('disk'), 'should mention disk space inspection');
    assert.ok(content.includes('journalctl') || content.includes('log'), 'should mention log inspection');
  });

  it('SOUL.md exists with thorough, cautious, detail-oriented persona', () => {
    const soulPath = join(inspectorDir, 'SOUL.md');
    assert.ok(existsSync(soulPath), 'SOUL.md should exist');
    
    const content = readFileSync(soulPath, 'utf-8').toLowerCase();
    
    // Should have cautious, thorough personality traits
    const hasThrough = content.includes('thorough') || content.includes('complete') || content.includes('detail');
    const hasCautious = content.includes('cautious') || content.includes('careful') || content.includes('risk');
    const hasInspector = content.includes('inspector') || content.includes('observe') || content.includes('document');
    
    assert.ok(hasThrough, 'should emphasize thoroughness');
    assert.ok(hasCautious, 'should emphasize caution');
    assert.ok(hasInspector, 'should emphasize inspection/observation role');
  });

  it('SOUL.md emphasizes read-only nature and risk awareness', () => {
    const soulPath = join(inspectorDir, 'SOUL.md');
    const content = readFileSync(soulPath, 'utf-8').toLowerCase();
    
    // Should emphasize not modifying system state
    const hasReadOnly = 
      content.includes('read-only') || 
      content.includes('never modify') || 
      content.includes('observe') ||
      content.includes('not an implementer');
    
    // Should mention risk assessment
    const hasRisk = content.includes('risk') || content.includes('warning') || content.includes('cautious');
    
    assert.ok(hasReadOnly, 'should emphasize read-only/observation role');
    assert.ok(hasRisk, 'should emphasize risk awareness');
  });

  it('IDENTITY.md exists and defines role for examining system state', () => {
    const identityPath = join(inspectorDir, 'IDENTITY.md');
    assert.ok(existsSync(identityPath), 'IDENTITY.md should exist');
    
    const content = readFileSync(identityPath, 'utf-8').toLowerCase();
    
    assert.ok(content.includes('name:') && content.includes('inspector'), 'should define name as Inspector');
    assert.ok(content.includes('role:'), 'should define role');
    
    // Role should mention examination/inspection/state
    const hasExamine = 
      content.includes('examine') || 
      content.includes('inspect') || 
      content.includes('state') ||
      content.includes('baseline');
    
    assert.ok(hasExamine, 'role should mention examining or inspecting system state');
  });

  it('inspector agent role aligns with analysis role (read-only)', () => {
    const agentsPath = join(inspectorDir, 'AGENTS.md');
    const content = readFileSync(agentsPath, 'utf-8').toLowerCase();
    
    // Inspector should be read-only (analysis role in the type system)
    assert.ok(
      content.includes('read-only') || content.includes('read only'),
      'inspector should be read-only (analysis role)'
    );
    
    // Should NOT implement changes
    assert.ok(
      content.includes('never modify') || 
      content.includes('don\'t modify') || 
      content.includes('do not modify'),
      'inspector should not modify system state'
    );
  });
});
