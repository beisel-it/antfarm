import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

describe('ops-config planner agent', () => {
  const plannerDir = join(process.cwd(), 'workflows/ops-config/agents/planner');

  it('planner directory exists', () => {
    assert.ok(existsSync(plannerDir), 'planner directory should exist');
    assert.ok(statSync(plannerDir).isDirectory(), 'planner should be a directory');
  });

  it('AGENTS.md exists and defines decomposition process', () => {
    const agentsPath = join(plannerDir, 'AGENTS.md');
    assert.ok(existsSync(agentsPath), 'AGENTS.md should exist');
    
    const content = readFileSync(agentsPath, 'utf-8');
    
    // Verify key sections exist
    assert.ok(content.includes('# Planner Agent'), 'Should have Planner Agent heading');
    assert.ok(content.includes('## Your Process'), 'Should define the planning process');
    assert.ok(content.includes('## Configuration Change Sizing'), 'Should explain sizing strategy');
    assert.ok(content.includes('## Step Ordering'), 'Should explain ordering strategy');
    assert.ok(content.includes('## Verification'), 'Should explain verification requirements');
  });

  it('AGENTS.md includes required output format with TARGET_SYSTEM, CHANGE_TYPE, VERIFICATION_STEPS_JSON', () => {
    const agentsPath = join(plannerDir, 'AGENTS.md');
    const content = readFileSync(agentsPath, 'utf-8');
    
    // Verify output format section exists
    assert.ok(content.includes('## Output Format'), 'Should have Output Format section');
    
    // Verify required output fields are documented
    assert.ok(content.includes('TARGET_SYSTEM:'), 'Should document TARGET_SYSTEM field');
    assert.ok(content.includes('CHANGE_TYPE:'), 'Should document CHANGE_TYPE field');
    assert.ok(content.includes('VERIFICATION_STEPS_JSON:'), 'Should document VERIFICATION_STEPS_JSON field');
    
    // Verify it shows a complete example with all three fields
    const outputSection = content.split('## Output Format')[1];
    assert.ok(outputSection, 'Output Format section should exist');
    assert.ok(outputSection.includes('TARGET_SYSTEM:'), 'Example should include TARGET_SYSTEM');
    assert.ok(outputSection.includes('CHANGE_TYPE:'), 'Example should include CHANGE_TYPE');
    assert.ok(outputSection.includes('VERIFICATION_STEPS_JSON:'), 'Example should include VERIFICATION_STEPS_JSON');
  });

  it('AGENTS.md defines verification step structure with step, command, and expected fields', () => {
    const agentsPath = join(plannerDir, 'AGENTS.md');
    const content = readFileSync(agentsPath, 'utf-8');
    
    // Verify verification steps are documented with the correct structure
    assert.ok(content.includes('"step":'), 'Should document step field in verification');
    assert.ok(content.includes('"command":'), 'Should document command field in verification');
    assert.ok(content.includes('"expected":'), 'Should document expected field in verification');
    
    // Verify example verification steps exist
    assert.ok(content.includes('systemctl status') || content.includes('systemctl is-active'), 
      'Should include systemctl status check example');
  });

  it('SOUL.md exists with analytical, methodical, systems-thinking persona', () => {
    const soulPath = join(plannerDir, 'SOUL.md');
    assert.ok(existsSync(soulPath), 'SOUL.md should exist');
    
    const content = readFileSync(soulPath, 'utf-8');
    
    // Verify it has Soul heading
    assert.ok(content.includes('# Soul'), 'Should have Soul heading');
    
    // Verify key personality traits for ops planner
    assert.ok(
      content.toLowerCase().includes('analytical') || 
      content.toLowerCase().includes('methodical') ||
      content.toLowerCase().includes('systems'),
      'Should describe analytical/methodical/systems-oriented personality'
    );
    
    // Verify it emphasizes safety and verification
    assert.ok(
      content.toLowerCase().includes('safety') || 
      content.toLowerCase().includes('verification') ||
      content.toLowerCase().includes('backup'),
      'Should emphasize safety and verification'
    );
  });

  it('IDENTITY.md exists and defines role for planning config changes', () => {
    const identityPath = join(plannerDir, 'IDENTITY.md');
    assert.ok(existsSync(identityPath), 'IDENTITY.md should exist');
    
    const content = readFileSync(identityPath, 'utf-8');
    
    // Verify it has Identity heading
    assert.ok(content.includes('# Identity'), 'Should have Identity heading');
    
    // Verify it defines the role
    assert.ok(content.includes('Role:'), 'Should define Role');
    
    // Verify role is about planning/decomposing configuration changes
    assert.ok(
      content.toLowerCase().includes('plan') ||
      content.toLowerCase().includes('decompose'),
      'Role should mention planning or decomposing'
    );
    
    assert.ok(
      content.toLowerCase().includes('config') ||
      content.toLowerCase().includes('change'),
      'Role should mention configuration or changes'
    );
  });

  it('planner agent role aligns with analysis role (read-only)', () => {
    const agentsPath = join(plannerDir, 'AGENTS.md');
    const content = readFileSync(agentsPath, 'utf-8');
    
    // Planner should NOT implement changes, only plan them
    assert.ok(
      content.includes("Don't implement") || 
      content.includes("NOT an implementer") ||
      content.includes("you're a planner"),
      'Should clarify that planner does not implement changes (analysis role)'
    );
  });
});
